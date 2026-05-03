const { Pool } = require("pg");
const jwt = require("jsonwebtoken");

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function authenticateToken(event) {
  const authHeader = event.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    throw new Error("未登录");
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return user;
  } catch (err) {
    throw new Error("登录已过期");
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const user = authenticateToken(event);
    const result = await pool.query(
      "SELECT * FROM roco_hunt_records WHERE user_id = $1 ORDER BY last_modified DESC",
      [user.id],
    );
    const hunts = result.rows.map((row) => ({
      ...row.captures,
      id: row.record_id,
    }));
    return {
      statusCode: 200,
      body: JSON.stringify(hunts),
    };
  } catch (err) {
    console.error(err);
    if (err.message === "未登录" || err.message === "登录已过期") {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: err.message }),
      };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "拉取记录失败" }),
    };
  }
};
