/**
 * Twitch API Client — StreamCPA
 *
 * Wraps the Twitch Helix API for streamer validation,
 * profile syncing, and stream status checks.
 *
 * Uses App Access Token (client_credentials) for server-side calls.
 * Token is cached and auto-refreshed on expiry.
 */

// ==========================================
// TYPES
// ==========================================

interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: "" | "affiliate" | "partner";
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number;
  created_at: string;
}

interface TwitchStream {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: "live" | "";
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string;
  tags: string[];
}

interface TwitchChannelInfo {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  delay: number;
  tags: string[];
}

export interface StreamerProfile {
  twitchId: string;
  username: string;
  displayName: string;
  avatar: string;
  broadcasterType: "" | "affiliate" | "partner";
  description: string;
  viewCount: number;
  createdAt: string;
}

export interface StreamStatus {
  isLive: boolean;
  title: string | null;
  gameName: string | null;
  viewerCount: number;
  startedAt: string | null;
  language: string | null;
}

// ==========================================
// TOKEN MANAGEMENT
// ==========================================

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAppAccessToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(`Twitch token error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cachedToken.token;
}

// ==========================================
// API CLIENT
// ==========================================

async function twitchFetch<T>(endpoint: string): Promise<T> {
  const token = await getAppAccessToken();

  const response = await fetch(`https://api.twitch.tv/helix${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Client-Id": process.env.TWITCH_CLIENT_ID!,
    },
  });

  if (!response.ok) {
    // If unauthorized, clear token cache and retry once
    if (response.status === 401) {
      cachedToken = null;
      const newToken = await getAppAccessToken();
      const retryResponse = await fetch(
        `https://api.twitch.tv/helix${endpoint}`,
        {
          headers: {
            Authorization: `Bearer ${newToken}`,
            "Client-Id": process.env.TWITCH_CLIENT_ID!,
          },
        },
      );
      if (!retryResponse.ok) {
        throw new Error(
          `Twitch API error: ${retryResponse.status} ${retryResponse.statusText}`,
        );
      }
      return retryResponse.json();
    }

    throw new Error(
      `Twitch API error: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

// ==========================================
// PUBLIC FUNCTIONS
// ==========================================

/**
 * Get a Twitch user by their login name
 */
export async function getTwitchUser(
  login: string,
): Promise<StreamerProfile | null> {
  const data = await twitchFetch<{ data: TwitchUser[] }>(
    `/users?login=${encodeURIComponent(login)}`,
  );

  if (!data.data.length) return null;

  const user = data.data[0];
  return {
    twitchId: user.id,
    username: user.login,
    displayName: user.display_name,
    avatar: user.profile_image_url,
    broadcasterType: user.broadcaster_type,
    description: user.description,
    viewCount: user.view_count,
    createdAt: user.created_at,
  };
}

/**
 * Get a Twitch user by their Twitch ID
 */
export async function getTwitchUserById(
  id: string,
): Promise<StreamerProfile | null> {
  const data = await twitchFetch<{ data: TwitchUser[] }>(
    `/users?id=${encodeURIComponent(id)}`,
  );

  if (!data.data.length) return null;

  const user = data.data[0];
  return {
    twitchId: user.id,
    username: user.login,
    displayName: user.display_name,
    avatar: user.profile_image_url,
    broadcasterType: user.broadcaster_type,
    description: user.description,
    viewCount: user.view_count,
    createdAt: user.created_at,
  };
}

/**
 * Check if a streamer is currently live
 */
export async function getStreamStatus(
  twitchId: string,
): Promise<StreamStatus> {
  const data = await twitchFetch<{ data: TwitchStream[] }>(
    `/streams?user_id=${encodeURIComponent(twitchId)}`,
  );

  if (!data.data.length || data.data[0].type !== "live") {
    return {
      isLive: false,
      title: null,
      gameName: null,
      viewerCount: 0,
      startedAt: null,
      language: null,
    };
  }

  const stream = data.data[0];
  return {
    isLive: true,
    title: stream.title,
    gameName: stream.game_name,
    viewerCount: stream.viewer_count,
    startedAt: stream.started_at,
    language: stream.language,
  };
}

/**
 * Get channel information
 */
export async function getChannelInfo(
  twitchId: string,
): Promise<TwitchChannelInfo | null> {
  const data = await twitchFetch<{ data: TwitchChannelInfo[] }>(
    `/channels?broadcaster_id=${encodeURIComponent(twitchId)}`,
  );

  return data.data.length ? data.data[0] : null;
}

/**
 * Validate a streamer meets minimum requirements for the platform.
 * Returns { valid, reasons } — reasons explains why they don't qualify.
 */
export async function validateStreamer(
  login: string,
): Promise<{ valid: boolean; reasons: string[]; profile?: StreamerProfile }> {
  const profile = await getTwitchUser(login);
  const reasons: string[] = [];

  if (!profile) {
    return { valid: false, reasons: ["Twitch user not found"] };
  }

  // Must be at least affiliate
  if (
    profile.broadcasterType !== "affiliate" &&
    profile.broadcasterType !== "partner"
  ) {
    reasons.push(
      "Must be at least a Twitch Affiliate. Currently: " +
        (profile.broadcasterType || "regular"),
    );
  }

  // Account must be at least 30 days old
  const accountAge = Date.now() - new Date(profile.createdAt).getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  if (accountAge < thirtyDays) {
    reasons.push("Account must be at least 30 days old");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    profile,
  };
}

/**
 * Get multiple Twitch users by IDs (batched, max 100)
 */
export async function getTwitchUsersByIds(
  ids: string[],
): Promise<StreamerProfile[]> {
  if (ids.length === 0) return [];

  // Twitch API supports max 100 IDs per request
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    batches.push(ids.slice(i, i + 100));
  }

  const results: StreamerProfile[] = [];

  for (const batch of batches) {
    const query = batch.map((id) => `id=${encodeURIComponent(id)}`).join("&");
    const data = await twitchFetch<{ data: TwitchUser[] }>(`/users?${query}`);

    for (const user of data.data) {
      results.push({
        twitchId: user.id,
        username: user.login,
        displayName: user.display_name,
        avatar: user.profile_image_url,
        broadcasterType: user.broadcaster_type,
        description: user.description,
        viewCount: user.view_count,
        createdAt: user.created_at,
      });
    }
  }

  return results;
}
