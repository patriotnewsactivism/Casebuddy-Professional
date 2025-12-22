interface VideoRoom {
  caseId: number;
  roomName: string;
  roomUrl: string;
  createdAt: Date;
  participants: Map<string, { name: string; joinedAt: Date }>;
}

const activeRooms: Map<number, VideoRoom> = new Map();
const pendingRoomCreations: Map<number, Promise<VideoRoom>> = new Map();

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = "https://api.daily.co/v1";

async function createDailyRoom(roomName: string): Promise<{ url: string; name: string }> {
  if (!DAILY_API_KEY) {
    throw new Error("DAILY_API_KEY is not configured. Please add your Daily.co API key to secrets.");
  }

  // Sanitize room name - Daily.co only allows lowercase alphanumeric and hyphens
  const sanitizedName = roomName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 40);

  console.log(`[VideoRoom] Creating Daily.co room: ${sanitizedName}`);

  const response = await fetch(`${DAILY_API_URL}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: sanitizedName,
      privacy: "public",
      properties: {
        exp: Math.floor(Date.now() / 1000) + 3600 * 2, // 2 hour expiry
        enable_chat: true,
        enable_screenshare: true,
        enable_recording: false,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[VideoRoom] Daily.co API error (${response.status}):`, errorText);
    
    // If room already exists, try to get it
    if (response.status === 400 && errorText.includes("already exists")) {
      const existingRoom = await getDailyRoom(sanitizedName);
      if (existingRoom) {
        console.log(`[VideoRoom] Using existing room: ${existingRoom.url}`);
        return existingRoom;
      }
    }
    
    // Authentication error - API key is invalid
    if (response.status === 401 || errorText.includes("authentication")) {
      throw new Error("Daily.co API key is invalid or expired. Please update your DAILY_API_KEY in secrets.");
    }
    
    throw new Error(`Failed to create Daily room: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[VideoRoom] Room created successfully: ${data.url}`);
  return { url: data.url, name: data.name };
}

async function getDailyRoom(roomName: string): Promise<{ url: string; name: string } | null> {
  if (!DAILY_API_KEY) {
    return null;
  }

  const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${DAILY_API_KEY}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return { url: data.url, name: data.name };
}

async function deleteDailyRoom(roomName: string): Promise<void> {
  if (!DAILY_API_KEY) {
    return;
  }

  try {
    await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${DAILY_API_KEY}`,
      },
    });
  } catch (error) {
    console.error("Failed to delete Daily room:", error);
  }
}

async function createRoomInternal(caseId: number): Promise<VideoRoom> {
  // Generate a unique room name
  const roomName = `casebuddy-${caseId}-${Date.now()}`;

  // Create room on Daily.co
  const dailyRoom = await createDailyRoom(roomName);

  const room: VideoRoom = {
    caseId,
    roomName: dailyRoom.name,
    roomUrl: dailyRoom.url,
    createdAt: new Date(),
    participants: new Map(),
  };

  activeRooms.set(caseId, room);
  return room;
}

export async function getOrCreateRoom(caseId: number): Promise<VideoRoom> {
  // Check if we already have an active room for this case
  if (activeRooms.has(caseId)) {
    return activeRooms.get(caseId)!;
  }

  // Check if room creation is already in progress (handle concurrent requests)
  if (pendingRoomCreations.has(caseId)) {
    return pendingRoomCreations.get(caseId)!;
  }

  // Start room creation and store the promise
  const creationPromise = createRoomInternal(caseId);
  pendingRoomCreations.set(caseId, creationPromise);

  try {
    const room = await creationPromise;
    return room;
  } finally {
    // Clean up pending promise after completion
    pendingRoomCreations.delete(caseId);
  }
}

export function addParticipant(caseId: number, odId: string, odName: string): void {
  const room = activeRooms.get(caseId);
  if (room) {
    room.participants.set(odId, { name: odName, joinedAt: new Date() });
  }
}

export async function removeParticipant(caseId: number, odId: string): Promise<void> {
  const room = activeRooms.get(caseId);
  if (room) {
    room.participants.delete(odId);
    // If no participants left, clean up the room
    if (room.participants.size === 0) {
      await deleteDailyRoom(room.roomName);
      activeRooms.delete(caseId);
    }
  }
}

export function getRoomParticipants(caseId: number): Array<{ id: string; name: string }> {
  const room = activeRooms.get(caseId);
  if (!room) return [];

  return Array.from(room.participants.entries()).map(([id, data]) => ({
    id,
    name: data.name,
  }));
}
