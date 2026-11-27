import { createContext, useContext } from 'react';

export const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

const LEVEL = { viewer: 0, analyst: 1, admin: 2 };
export const can = (user, role) => !!user && LEVEL[user.role] >= LEVEL[role];
