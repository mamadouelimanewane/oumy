/**
 * Helper de pagination pour les endpoints liste
 * Extrait page/limit de req.query et retourne les paramètres SQL
 */
const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

const paginatedResponse = (data, total, { page, limit }) => {
  return {
    data,
    pagination: {
      page,
      limit,
      total: parseInt(total),
      totalPages: Math.ceil(parseInt(total) / limit),
    },
  };
};

module.exports = { paginate, paginatedResponse };
