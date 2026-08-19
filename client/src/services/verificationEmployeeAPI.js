const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    throw new Error(body?.error || body?.message || "Request failed");
  }

  return body;
};

export const verificationEmployeeAPI = {
  list: () => request("/admin/verification-employees"),

  create: (data) =>
    request("/admin/verification-employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id, data) =>
    request(`/admin/verification-employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

export default verificationEmployeeAPI;
