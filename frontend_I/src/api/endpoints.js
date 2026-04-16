const BASE_URL =  "http://localhost:5001/api";

export const API_ENDPOINTS = {
    BASE_URL,
    LOGIN: `${BASE_URL}/admin/login`,
    REGISTER: `${BASE_URL}/admin/register`,
    GET_ADMIN: `${BASE_URL}/admin/:id`,
    SETUP_MFA: `${BASE_URL}/auth/setup`,
    VERIFY_MFA: `${BASE_URL}/auth/login`,
    DATA: {
        SAVE: `${BASE_URL}/data`,
        STRUCTURE: `${BASE_URL}/data/structure`,
        BASE: `${BASE_URL}/data` // Append ID for GET/PUT/DELETE
    }
};
