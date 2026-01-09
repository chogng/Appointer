let currentMockUser = null;

export const getMockUser = () => currentMockUser;

export const setMockUser = (user) => {
  currentMockUser = user ?? null;
};

export const clearMockUser = () => {
  currentMockUser = null;
};

