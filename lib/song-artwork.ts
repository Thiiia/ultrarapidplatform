const ID3_HEADER_BYTES = 10;
const MAX_ID3_TAG_BYTES = 512_000;
const MAX_ID3_COVER_BYTES = 512_000;

export type Id3FrontCover = {
  mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  bytes: Uint8Array;
};

/**
 * Square Apple Music release art for tracks whose embedded ID3 image is a
 * padded video still. These entries were matched by exact track and artist:
 * - Garden — https://music.apple.com/gb/album/garden/1533425954?i=1533425958
 * - GEMINI QUEEN — https://music.apple.com/gb/album/gemini-queen/6786786542?i=6786786544
 * - one & one — https://music.apple.com/gb/album/one-one/1835165706?i=1835165707
 * - Seven — https://music.apple.com/gb/album/seven/1515988014?i=1515988303
 */
export const SONG_CHOICE_COVER_OVERRIDE_BY_ID: Readonly<Record<string, string>> =
  Object.freeze({
    garden:
      "https://is1-ssl.mzstatic.com/image/thumb/Music114/v4/6f/18/fd/6f18fd75-11ee-9a03-c127-6414ed628181/5054526060623_1.jpg/600x600bb.jpg",
    geminiqueen:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/74/0e/4e/740e4e3d-8bdb-73d2-31ea-af799025e0df/artwork.jpg/600x600bb.jpg",
    oneone:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b9/30/54/b93054db-f41a-5099-ca01-a40cbd91f237/artwork.jpg/600x600bb.jpg",
    seven:
      "https://is1-ssl.mzstatic.com/image/thumb/Music123/v4/a3/27/f5/a327f580-9584-2ac2-51f2-fbba6a286dd8/5054526515390_1.jpg/600x600bb.jpg",
  });

/**
 * Official Apple Music release artwork for catalog songs without an embedded
 * ID3 front cover. The client keeps its designed fallback if a remote image
 * cannot be loaded.
 *
 * Verified release pages:
 * - oogie — grudge: https://music.apple.com/us/album/grudge/1884032110?i=1884032111
 * - oogie — Just Because: https://music.apple.com/us/album/just-because/1730444997?i=1730445272
 * - Melika — jazz in the maybach: https://music.apple.com/us/album/jazz-in-the-maybach/1815838192?i=1815838193
 * - Metrik & Grafix — Waves: https://music.apple.com/us/album/waves/1822753095?i=1822753907
 */
export const SONG_CHOICE_COVER_FALLBACK_BY_ID: Readonly<Record<string, string>> =
  Object.freeze({
    grudge:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/31/00/ba/3100ba03-a53d-7a53-777e-0aa530805159/859733646326_cover.jpg/600x600bb.jpg",
    justbecause:
      "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/30/94/9e/30949e10-3724-cb09-6e54-dff8b2513e45/859784060478_cover.jpg/600x600bb.jpg",
    jazzmaybach:
      "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/d4/8a/98/d48a98e8-a35e-a422-5f47-33c9b149f43d/artwork.jpg/600x600bb.jpg",
    waves:
      "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/97/12/37/9712375b-f4af-0b74-adf4-289a6c531956/cover.jpg/600x600bb.jpg",
  });

export function getSongChoiceCoverArt(
  songId: string,
  embeddedCoverArtBySongId: Readonly<Record<string, string>>,
) {
  return getSongChoiceCoverArtCandidates(songId, embeddedCoverArtBySongId)[0] ?? null;
}

export function getSongChoiceCoverArtCandidates(
  songId: string,
  embeddedCoverArtBySongId: Readonly<Record<string, string>>,
) {
  return Array.from(
    new Set(
      [
        SONG_CHOICE_COVER_OVERRIDE_BY_ID[songId],
        embeddedCoverArtBySongId[songId],
        SONG_CHOICE_COVER_FALLBACK_BY_ID[songId],
      ].filter((source): source is string => Boolean(source)),
    ),
  );
}

function readSynchsafeInteger(bytes: Uint8Array, offset: number) {
  if (offset + 4 > bytes.length) return null;
  const value = bytes.slice(offset, offset + 4);
  if (value.some((byte) => (byte & 0x80) !== 0)) return null;
  return (value[0] << 21) | (value[1] << 14) | (value[2] << 7) | value[3];
}

function readFrameSize(bytes: Uint8Array, offset: number, version: number) {
  if (offset + 4 > bytes.length) return null;
  if (version === 4) return readSynchsafeInteger(bytes, offset);
  return (
    bytes[offset] * 0x1000000 +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function findStringTerminator(
  bytes: Uint8Array,
  start: number,
  end: number,
  utf16: boolean,
) {
  if (utf16) {
    for (let index = start; index + 1 < end; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) return index + 2;
    }
    return -1;
  }

  const terminator = bytes.indexOf(0, start);
  return terminator >= start && terminator < end ? terminator + 1 : -1;
}

function isSupportedRaster(
  mimeType: string,
  bytes: Uint8Array,
): mimeType is Id3FrontCover["mimeType"] {
  if (bytes.length === 0 || bytes.length > MAX_ID3_COVER_BYTES) return false;
  if (
    mimeType === "image/png" &&
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return true;
  }
  if (mimeType === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return true;
  }
  if (
    mimeType === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return true;
  }
  return (
    mimeType === "image/gif" &&
    bytes.length >= 6 &&
    (String.fromCharCode(...bytes.slice(0, 6)) === "GIF87a" ||
      String.fromCharCode(...bytes.slice(0, 6)) === "GIF89a")
  );
}

function parseAttachedPicture(
  bytes: Uint8Array,
  frameStart: number,
  frameEnd: number,
): Id3FrontCover | null {
  if (frameStart >= frameEnd) return null;
  const encoding = bytes[frameStart];
  if (encoding > 3) return null;

  let mimeEnd = frameStart + 1;
  while (mimeEnd < frameEnd && bytes[mimeEnd] !== 0) mimeEnd += 1;
  if (mimeEnd >= frameEnd) return null;

  const mimeType = new TextDecoder("ascii")
    .decode(bytes.slice(frameStart + 1, mimeEnd))
    .trim()
    .toLowerCase();
  const descriptionStart = mimeEnd + 2; // MIME terminator and picture type.
  if (descriptionStart > frameEnd) return null;

  const descriptionEnd = findStringTerminator(
    bytes,
    descriptionStart,
    frameEnd,
    encoding === 1 || encoding === 2,
  );
  if (descriptionEnd < 0 || descriptionEnd > frameEnd) return null;

  const imageBytes = bytes.slice(descriptionEnd, frameEnd);
  if (!isSupportedRaster(mimeType, imageBytes)) return null;
  return { mimeType, bytes: imageBytes };
}

/**
 * Reads an ID3v2.3/v2.4 APIC front-cover frame from a complete ID3 tag.
 * Unsynchronized and extended headers are rejected safely; the current
 * catalogue's embedded covers use standard, uncompressed ID3 tags.
 */
export function extractId3FrontCover(bytes: Uint8Array): Id3FrontCover | null {
  if (
    bytes.length < ID3_HEADER_BYTES ||
    String.fromCharCode(...bytes.slice(0, 3)) !== "ID3"
  ) {
    return null;
  }

  const version = bytes[3];
  const flags = bytes[5];
  if ((version !== 3 && version !== 4) || (flags & 0xc0) !== 0) return null;

  const tagSize = readSynchsafeInteger(bytes, 6);
  if (
    tagSize === null ||
    tagSize <= 0 ||
    tagSize > MAX_ID3_TAG_BYTES ||
    bytes.length < ID3_HEADER_BYTES + tagSize
  ) {
    return null;
  }

  const tagEnd = ID3_HEADER_BYTES + tagSize;
  let cursor = ID3_HEADER_BYTES;
  while (cursor + 10 <= tagEnd) {
    const frameId = String.fromCharCode(...bytes.slice(cursor, cursor + 4));
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

    const frameSize = readFrameSize(bytes, cursor + 4, version);
    if (
      frameSize === null ||
      frameSize <= 0 ||
      cursor + 10 + frameSize > tagEnd
    ) {
      break;
    }

    if (
      frameId === "APIC" &&
      bytes[cursor + 8] === 0 &&
      bytes[cursor + 9] === 0
    ) {
      const frameStart = cursor + 10;
      const frameEnd = frameStart + frameSize;
      const pictureTypeOffset = bytes.indexOf(0, frameStart + 1) + 1;

      if (pictureTypeOffset >= frameStart + 1 && pictureTypeOffset < frameEnd) {
        const pictureType = bytes[pictureTypeOffset];
        if (pictureType === 3) {
          const cover = parseAttachedPicture(bytes, frameStart, frameEnd);
          if (cover) return cover;
        }
      }
    }

    cursor += 10 + frameSize;
  }

  return null;
}

export function getId3TagLength(header: Uint8Array) {
  if (
    header.length < ID3_HEADER_BYTES ||
    String.fromCharCode(...header.slice(0, 3)) !== "ID3" ||
    (header[3] !== 3 && header[3] !== 4) ||
    (header[5] & 0xc0) !== 0
  ) {
    return null;
  }

  const tagSize = readSynchsafeInteger(header, 6);
  if (tagSize === null || tagSize <= 0 || tagSize > MAX_ID3_TAG_BYTES) {
    return null;
  }

  return ID3_HEADER_BYTES + tagSize;
}

/**
 * Reads only the small ID3 tag range, never the full song. Missing or
 * unsupported covers resolve to null so the chooser can show its designed
 * fallback artwork.
 */
export async function fetchId3FrontCover(audioUrl: string, signal?: AbortSignal) {
  const headerResponse = await fetch(audioUrl, {
    headers: { Range: "bytes=0-9" },
    signal,
  });
  if (!headerResponse.ok || headerResponse.status !== 206) {
    await headerResponse.body?.cancel().catch(() => undefined);
    return null;
  }

  const header = new Uint8Array(await headerResponse.arrayBuffer());
  const tagLength = getId3TagLength(header);
  if (!tagLength) return null;

  const tagResponse = await fetch(audioUrl, {
    headers: { Range: "bytes=0-" + (tagLength - 1) },
    signal,
  });
  if (!tagResponse.ok || tagResponse.status !== 206) {
    await tagResponse.body?.cancel().catch(() => undefined);
    return null;
  }

  const contentLength = Number(tagResponse.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_ID3_TAG_BYTES + 10) {
    await tagResponse.body?.cancel().catch(() => undefined);
    return null;
  }

  const tag = new Uint8Array(await tagResponse.arrayBuffer());
  const cover = extractId3FrontCover(tag);
  if (!cover) return null;

  const copy = new Uint8Array(cover.bytes.length);
  copy.set(cover.bytes);
  return new Blob([copy.buffer], { type: cover.mimeType });
}
