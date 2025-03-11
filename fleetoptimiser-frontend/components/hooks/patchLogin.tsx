import axios from "axios";

export async function updateUserLogin(userId: string) {
  await axios.patch(`http://backend:3001/api/user/${userId}/login`)
}
