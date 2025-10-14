import { useAuth } from '../../contexts/authContext';
import { Navigate } from 'react-router-dom';

const PrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Navigate to="/" />;
  }

  return children;
};

export default PrivateRoute;
