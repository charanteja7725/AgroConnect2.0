import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { verificationEmployeeAPI } from "../../services/verificationEmployeeAPI.js";
import "./verificationEmployees.css";

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  state: "",
  districts: "",
};

export default function VerificationEmployees() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadEmployees = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await verificationEmployeeAPI.list();
      setEmployees(data.employees || []);
    } catch (err) {
      setError(err.message || "Unable to load verification employees.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const change = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const createEmployee = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      await verificationEmployeeAPI.create({
        ...form,
        districts: form.districts
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setForm(emptyForm);
      setMessage("Verification employee created successfully.");
      await loadEmployees();
    } catch (err) {
      setError(err.message || "Unable to create verification employee.");
    }
  };

  const toggleEmployee = async (employee) => {
    setError("");
    setMessage("");
    try {
      await verificationEmployeeAPI.update(employee._id, {
        isActive: !employee.isActive,
      });
      setMessage(`Employee ${employee.isActive ? "deactivated" : "activated"}.`);
      await loadEmployees();
    } catch (err) {
      setError(err.message || "Unable to update employee.");
    }
  };

  return (
    <div className="verification-employees-page">
      <div className="verification-employees-shell">
        <div className="verification-employees-titlebar">
          <div>
            <h1>Area Verification Employees</h1>
            <p>Create local reviewer accounts and assign their state/district coverage.</p>
          </div>
          <button type="button" onClick={() => navigate("/admin")}>← Admin Dashboard</button>
        </div>

        {error && <div className="verification-employees-alert error">{error}</div>}
        {message && <div className="verification-employees-alert success">{message}</div>}

        <form className="verification-employee-form" onSubmit={createEmployee}>
          <h2>Create Verification Employee</h2>
          <div className="verification-employee-grid">
            <input required placeholder="First name" value={form.firstName} onChange={(e) => change("firstName", e.target.value)} />
            <input required placeholder="Last name" value={form.lastName} onChange={(e) => change("lastName", e.target.value)} />
            <input required type="email" placeholder="Employee email" value={form.email} onChange={(e) => change("email", e.target.value)} />
            <input required type="password" minLength={8} placeholder="Temporary password (8+ chars)" value={form.password} onChange={(e) => change("password", e.target.value)} />
            <input required placeholder="Phone" value={form.phone} onChange={(e) => change("phone", e.target.value)} />
            <input required placeholder="Assigned state" value={form.state} onChange={(e) => change("state", e.target.value)} />
          </div>
          <input
            className="district-input"
            placeholder="Districts, comma separated (leave blank for all districts in the state)"
            value={form.districts}
            onChange={(e) => change("districts", e.target.value)}
          />
          <button type="submit">Create Employee</button>
        </form>

        <section className="verification-employee-list-card">
          <h2>Current Employees</h2>
          {loading ? (
            <p>Loading...</p>
          ) : employees.length === 0 ? (
            <p>No verification employees created yet.</p>
          ) : (
            <div className="verification-employee-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>State</th>
                    <th>Districts</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee._id}>
                      <td>{employee.firstName} {employee.lastName}</td>
                      <td>{employee.email}</td>
                      <td>{employee.phone}</td>
                      <td>{employee.verificationArea?.state || "Not assigned"}</td>
                      <td>
                        {employee.verificationArea?.districts?.length
                          ? employee.verificationArea.districts.join(", ")
                          : "All districts"}
                      </td>
                      <td>{employee.isActive ? "Active" : "Inactive"}</td>
                      <td>
                        <button
                          type="button"
                          className={employee.isActive ? "deactivate" : "activate"}
                          onClick={() => toggleEmployee(employee)}
                        >
                          {employee.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
