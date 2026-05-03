import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('robocode-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const authAPI = {
  login: () => {
    window.location.href = `/api/auth/login`
  },
  logout: () => api.post('/auth/logout'),
  getProfile: () => api.get('/auth/profile'),
}

export const playerAPI = {
  getProfile: () => api.get('/player/profile'),
  updateProfile: (data: any) => api.patch('/player/profile', data),
  getConceptMastery: () => api.get('/player/concept-mastery'),
}

export const questionsAPI = {
  generate: (concept: string, difficulty: string) => 
    api.post('/questions/generate', { concept, difficulty }),
  submitAnswer: (questionId: string, answer: string) =>
    api.post('/questions/answer', { questionId, answer }),
}

export const battleAPI = {
  createScript: (scriptBody: string, scriptName?: string) =>
    api.post('/battle/script', { scriptBody, scriptName }),
  validateScript: (scriptBody: string) =>
    api.post('/battle/validate', { scriptBody }),
  submitScript: (matchId: string, scriptBody: string) =>
    api.post(`/battle/${matchId}/submit`, { scriptBody }),
  getReplay: (matchId: string) =>
    api.get(`/battle/${matchId}/replay`),
}

export const shopAPI = {
  getCatalog: () => api.get('/shop/catalog'),
  purchase: (itemId: string) => api.post('/shop/purchase', { itemId }),
  getInventory: () => api.get('/shop/inventory'),
}

export const storyAPI = {
  getProgress: () => api.get('/story/progress'),
  completeQuest: (chapter: number, quest: number, score: number) =>
    api.post('/story/complete', { chapter, quest, score }),
}
