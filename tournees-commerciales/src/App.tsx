import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useProfil } from './state/ProfilContext';
import ParametresPage from './features/parametres/ParametresPage';
import CartePage from './features/carte/CartePage';
import PlanifierPage from './features/tournee/PlanifierPage';
import AujourdhuiPage from './features/tournee/AujourdhuiPage';
import CompteRenduPage from './features/compteRendu/CompteRenduPage';
import ProspectionPage from './features/prospection/ProspectionPage';
import IndicateursPage from './features/indicateurs/IndicateursPage';
import ManagerPage from './features/manager/ManagerPage';

export default function App() {
  const { isManager } = useProfil();
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to={isManager ? '/manager' : '/aujourdhui'} replace />} />
        <Route path="/aujourdhui" element={<AujourdhuiPage />} />
        <Route path="/compte-rendu/:compteId" element={<CompteRenduPage />} />
        <Route path="/carte" element={<CartePage />} />
        <Route path="/planifier" element={<PlanifierPage />} />
        <Route path="/prospection" element={<ProspectionPage />} />
        <Route path="/indicateurs" element={<IndicateursPage />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="/parametres" element={<ParametresPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
