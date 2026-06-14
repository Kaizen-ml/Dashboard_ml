async function request(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function fetchHealth() {
  return request("/api/health");
}

export async function fetchDashboardOverview() {
  return request("/api/dashboard/overview");
}

export async function fetchDashboardFacility() {
  return request("/api/dashboard/facility");
}

export async function fetchDashboardWorkloads() {
  return request("/api/dashboard/workloads");
}

export async function fetchDashboardGrid() {
  return request("/api/dashboard/grid");
}

export async function fetchDashboardRecommendation() {
  return request("/api/dashboard/recommendation");
}

export async function postDashboardSimulate(action: string, airParams?: any, liquidParams?: any) {
  return request("/api/dashboard/simulate", {
    method: "POST",
    body: JSON.stringify({
      action,
      air_params: airParams,
      liquid_params: liquidParams,
    }),
  });
}
