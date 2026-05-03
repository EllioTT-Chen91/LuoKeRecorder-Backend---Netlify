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
  if (event.httpMethod === "GET") {
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
  } else if (event.httpMethod === "POST") {
    try {
      const user = authenticateToken(event);
      const hunt = JSON.parse(event.body);
      // 使用不依赖 ON CONFLICT 唯一约束的 upsert 模式
      await pool.query(
        `WITH updated AS (
           UPDATE roco_hunt_records
           SET captures = $4, target = $3, last_modified = NOW()
           WHERE user_id = $1 AND record_id = $2
           RETURNING *
         )
         INSERT INTO roco_hunt_records (user_id, record_id, target, captures, last_modified)
         SELECT $1, $2, $3, $4, NOW()
         WHERE NOT EXISTS (SELECT 1 FROM updated);`,
        [user.id, hunt.id, hunt.petName, hunt],
      );
      return {
        statusCode: 201,
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
        body: JSON.stringify({ error: "同步失败" }),
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }
};
