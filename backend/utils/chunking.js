export function chunkText(text, size = 500, overlap = 50) {
  if (!text || text.length === 0) return [];
  
  const chunks = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    // We want to avoid breaking words if possible, but for a simple implementation,
    // exact character count is fine as requested in the assignment.
    const chunk = text.slice(startIndex, startIndex + size);
    chunks.push(chunk);
    
    startIndex += (size - overlap);
  }
  
  return chunks;
}
