import axios from 'axios';

export async function registerUser({ display_name, age, gender, email, password, avatarFile }) {
  const form = new FormData();
  form.append('display_name', display_name);
  form.append('age', age);
  form.append('gender', gender);
  form.append('email', email);
  form.append('password', password);
  if (avatarFile) form.append('avatar', avatarFile);

  const { data } = await axios.post('/api/auth/register', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function loginUser({ email, password }) {
  const { data } = await axios.post('/api/auth/login', { email, password });
  return data;
}
