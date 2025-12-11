/**
 * Avatar Component with Initials
 * Displays a colored circle with user initials
 */
export default function Avatar({ name, size = 40, className = '' }) {
  const initials = getInitials(name);
  const backgroundColor = generateColor(name);
  
  return (
    <div 
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor,
        fontSize: size * 0.4
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

function getInitials(name) {
  if (!name) return '?';
  
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function generateColor(name) {
  if (!name) return '#737373';
  
  // Generate a consistent color based on the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use orange-adjacent hues for brand consistency
  const hue = Math.abs(hash % 60) + 15; // Range: 15-75 (orange to yellow)
  const saturation = 60 + (Math.abs(hash >> 8) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
