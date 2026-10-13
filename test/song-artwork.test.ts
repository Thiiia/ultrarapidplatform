import assert from "node:assert/strict";
import test from "node:test";
import {
  extractId3FrontCover,
  fetchId3FrontCover,
  getId3TagLength,
} from "../lib/song-artwork";

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
]);

function synchsafe(value: number) {
  return new Uint8Array([
    (value >> 21) & 0x7f,
    (value >> 14) & 0x7f,
    (value >> 7) & 0x7f,
    value & 0x7f,
  ]);
}

function createId3Tag(version: 3 | 4, pictureType = 3) {
  const description = new TextEncoder().encode("Cover");
  const mimeType = new TextEncoder().encode("image/png");
  const framePayload = new Uint8Array(
    1 + mimeType.length + 1 + 1 + description.length + 1 + pngBytes.length,
  );
  let payloadOffset = 0;
  framePayload[payloadOffset++] = 3;
  framePayload.set(mimeType, payloadOffset);
  payloadOffset += mimeType.length;
  framePayload[payloadOffset++] = 0;
  framePayload[payloadOffset++] = pictureType;
  framePayload.set(description, payloadOffset);
  payloadOffset += description.length;
  framePayload[payloadOffset++] = 0;
  framePayload.set(pngBytes, payloadOffset);

  const frame = new Uint8Array(10 + framePayload.length);
  frame.set(new TextEncoder().encode("APIC"), 0);
  frame.set(
    version === 4
      ? synchsafe(framePayload.length)
      : new Uint8Array([
          (framePayload.length >>> 24) & 0xff,
          (framePayload.length >>> 16) & 0xff,
          (framePayload.length >>> 8) & 0xff,
          framePayload.length & 0xff,
        ]),
    4,
  );
  frame.set(framePayload, 10);

  const tag = new Uint8Array(10 + frame.length);
  tag.set(new TextEncoder().encode("ID3"), 0);
  tag[3] = version;
  tag[4] = 0;
  tag.set(synchsafe(frame.length), 6);
  tag.set(frame, 10);
  return tag;
}

for (const version of [3, 4] as const) {
  test(`extracts the front-cover APIC image from ID3v2.${version}`, () => {
    const tag = createId3Tag(version);
    const cover = extractId3FrontCover(tag);

    assert.equal(getId3TagLength(tag.subarray(0, 10)), tag.length);
    assert.equal(cover?.mimeType, "image/png");
    assert.deepEqual(cover?.bytes, pngBytes);
  });
}

test("ignores non-front-cover art and malformed/truncated tags", () => {
  assert.equal(extractId3FrontCover(createId3Tag(4, 4)), null);

  const truncated = createId3Tag(4).subarray(0, 18);
  assert.equal(extractId3FrontCover(truncated), null);
  assert.equal(getId3TagLength(new Uint8Array(10)), null);
});

test("loads only ID3 byte ranges when creating a front-cover Blob", async () => {
  const tag = createId3Tag(4);
  const ranges: string[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (_input, init) => {
    const range = new Headers(init?.headers).get("Range");
    assert.ok(range);
    ranges.push(range);
    return new Response(
      range === "bytes=0-9" ? tag.subarray(0, 10) : tag,
      { status: 206 },
    );
  }) as typeof fetch;

  try {
    const cover = await fetchId3FrontCover("https://assets.example.test/song.mp3");
    assert.ok(cover);
    assert.equal(cover.type, "image/png");
    assert.deepEqual(new Uint8Array(await cover.arrayBuffer()), pngBytes);
    assert.deepEqual(ranges, ["bytes=0-9", `bytes=0-${tag.length - 1}`]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
