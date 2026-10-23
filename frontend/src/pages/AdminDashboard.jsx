
import "./AdminDashboard.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:5000/api/admin";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      const token = localStorage.getItem("krishiToken");

      if (!token) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const headers = {
          Authorization: `Bearer ${token}`
        };

        const [statsResponse, usersResponse] = await Promise.all([
          fetch(`${API}/stats`, {
            headers,
            signal: controller.signal
          }),
          fetch(`${API}/users`, {
            headers,
            signal: controller.signal
          })
        ]);

        if (
          statsResponse.status === 401 ||
          statsResponse.status === 403 ||
          usersResponse.status === 401 ||
          usersResponse.status === 403
        ) {
          setError("Admin access denied. Please login again.");

          localStorage.removeItem("krishiToken");
          localStorage.removeItem("krishiUser");
          navigate("/login", { replace: true });
          return;
        }

        if (!statsResponse.ok || !usersResponse.ok) {
          throw new Error("Dashboard data could not be loaded.");
        }

        const statsData = await statsResponse.json();
        const usersData = await usersResponse.json();

        setStats(statsData);
        setUsers(usersData.users || []);
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message || "Server connection failed.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => controller.abort();
  }, [navigate]);

  function logout() {
    localStorage.removeItem("krishiToken");
    localStorage.removeItem("krishiUser");
    navigate("/login", { replace: true });
  }

  if (loading) return <p>Dashboard loading...</p>;

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <h1>🌱 Krishi Roth Admin</h1>
          <p>প্রজেক্ট পরিচালনা ও ব্যবহারকারীর তথ্য</p>
        </div>

        <button onClick={logout}>Logout</button>
      </header>

      {error && <p role="alert">{error}</p>}

      {stats && (
        <section className="admin-stats">
          <article className="admin-card">
            <h3>মোট ব্যবহারকারী</h3>
            <p>{stats.totalUsers}</p>
          </article>

          <article className="admin-card">
            <h3>মোট কৃষক</h3>
            <p>{stats.totalFarmers}</p>
          </article>

          <article className="admin-card">
            <h3>মোট Admin</h3>
            <p>{stats.totalAdmins}</p>
          </article>
        </section>
      )}

      <section className="admin-users">
        <h2>ব্যবহারকারীর তালিকা</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>নাম</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan="4">কোনো ব্যবহারকারী পাওয়া যায়নি।</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
