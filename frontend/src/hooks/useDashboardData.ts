import { useEffect, useState } from "react";
import {
  fetchDashboardFacility,
  fetchDashboardGrid,
  fetchDashboardOverview,
  fetchDashboardRecommendation,
  fetchDashboardWorkloads,
} from "../services/api";

export function useDashboardData() {
  const [data, setData] = useState({
    overview: null,
    facility: null,
    workloads: null,
    grid: null,
    recommendation: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [overview, facility, workloads, grid, recommendation] = await Promise.all([
          fetchDashboardOverview(),
          fetchDashboardFacility(),
          fetchDashboardWorkloads(),
          fetchDashboardGrid(),
          fetchDashboardRecommendation(),
        ]);

        if (!mounted) {
          return;
        }

        setData({
          overview,
          facility,
          workloads,
          grid,
          recommendation,
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error };
}
