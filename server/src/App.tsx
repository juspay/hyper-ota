import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Release from "./pages/Release";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/release/:org/:app" element={<Release />} />
        {/* ... other routes ... */}
      </Routes>
    </Router>
  );
}

export default App;
