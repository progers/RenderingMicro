// Compress a string using gzip, returning the base64-encoded result.
export async function compress(string) {
  const utf8Encoded = new TextEncoder().encode(string);
  const compressed = await new Response(utf8Encoded).arrayBuffer()
    .then(buffer => {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(buffer);
      writer.close();
      return new Response(stream.readable).arrayBuffer();
    });
  return btoa(String.fromCharCode.apply(null, new Uint8Array(compressed)));
}

// Decompress a base64-encoded gzipped string.
export async function decompress(string) {
  const compressedBytes = new Uint8Array(
    atob(string)
      .split('')
      .map(char => char.charCodeAt(0))
  );
  const decompressed = await new Response(compressedBytes).arrayBuffer()
    .then(buffer => {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(buffer);
      writer.close();
      return new Response(stream.readable).arrayBuffer();
    });
  return new TextDecoder().decode(decompressed);
}
