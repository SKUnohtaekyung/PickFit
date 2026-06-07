// ========================================
// PickFit Profile API Client
// ========================================
// 프로필(닉네임·성별) 수정. 서버가 세션도 함께 갱신하므로 응답의 user를
// 그대로 캐시에 반영하면 /me 재호출 없이 화면이 최신 상태가 된다.

import { apiRequest } from './client.js';

export async function updateProfile({ displayName, gender }) {
  const payload = await apiRequest('/api/profile', {
    method: 'POST',
    csrf: true,
    body: { displayName, gender },
  });

  return payload.data?.user || null;
}
