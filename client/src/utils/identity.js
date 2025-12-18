// Simulates a user logging in by generating a random ID per browser
export const getUserId = () => {
  let id = localStorage.getItem('airport_user_id');
  if (!id) {
    id = 'user-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('airport_user_id', id);
  }
  return id;
};

export const getUserName = () => {
  let name = localStorage.getItem('airport_user_name');
  if (!name) {
    const names = ["Alice", "Bob", "Charlie", "David", "Eve", "Frank"];
    name = names[Math.floor(Math.random() * names.length)] + " " + Math.floor(Math.random() * 100);
    localStorage.setItem('airport_user_name', name);
  }
  return name;
};