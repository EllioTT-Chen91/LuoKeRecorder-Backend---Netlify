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
  if (event.httpMethod !== "PUT") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const user = authenticateToken(event);
    const pathParts = event.path.split("/");
    const id = pathParts[pathParts.length - 1]; // 假设路径是 /api/hunts/:id
    const hunt = JSON.parse(event.body);
    await pool.query(
      "UPDATE roco_hunt_records SET captures = $1, target = $2, last_modified = NOW() WHERE user_id = $3 AND record_id = $4",
      [hunt, hunt.petName, user.id, id],
    );
    return {
      statusCode: 200,
      body: "",
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
      body: JSON.stringify({ error: "更新失败" }),
    };
  }
};
