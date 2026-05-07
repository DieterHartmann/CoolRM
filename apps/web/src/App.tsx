import { Routes, Route } from 'react-router-dom';

// TODO Phase 1: replace stubs with real pages
function LoginPage() {
  return <div>Login — Phase 1</div>;
}

function DashboardPage() {
  return <div>Dashboard — Phase 1</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<DashboardPage />} />
    </Routes>
  );
}
