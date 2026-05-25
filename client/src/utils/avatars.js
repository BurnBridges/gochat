export const getAvatarLetter = (name = "") =>
  name.charAt(0).toUpperCase();

export const getAvatarColor = (name = "") => {
  const colors = ["#2b5278", "#4e8cff", "#9b59b6", "#e67e22"];
  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};