import jwt from 'jsonwebtoken';

export const ROLES = {
  ADMIN: 'admin',
  SABEEL_EMPLOYEE: 'sabeel_employee',
  CLOUDS_TEX_EMPLOYEE: 'clouds_tex_employee',
};

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

export const requireAdmin = (req, res, next) => {
  if (req.user?.role !== ROLES.ADMIN) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  next();
};

export const requireEmployeeStore = (req, res, next) => {
  const store = req.user?.store;
  if (![ROLES.SABEEL_EMPLOYEE, ROLES.CLOUDS_TEX_EMPLOYEE].includes(req.user?.role) || !store) {
    return res.status(403).json({ error: 'Store employee access required.' });
  }
  req.employeeStore = store;
  next();
};

export const isAdminUser = (user) => user?.role === ROLES.ADMIN;
