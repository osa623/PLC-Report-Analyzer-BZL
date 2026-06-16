const BASE_URL = typeof window !== "undefined"
  ? `http://${window.location.hostname}:8005/api/companies`
  : "http://127.0.0.1:8005/api/companies";

export async function searchCompanies(query: string) {
  if (!query || query.length < 2) return [];

  try {
    const res = await fetch(
      `${BASE_URL}/search?q=${encodeURIComponent(query)}`
    );

    if (!res.ok) {
      console.error("Search failed:", res.status);
      return [];
    }

    const data = await res.json();
    console.log("🔍 SEARCH RESPONSE:", data);

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("FETCH ERROR:", err);
    return [];
  }
}

export async function getCompany(symbol: string) {
  try {
    const res = await fetch(
      `${BASE_URL}/company?q=${encodeURIComponent(symbol)}`
    );

    if (!res.ok) {
      console.error("Company fetch failed:", res.status);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("FETCH ERROR:", err);
    return null;
  }
}