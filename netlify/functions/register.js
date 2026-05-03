const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { username, password } = JSON.parse(event.body);
    const check = await pool.query("SELECT * FROM users WHERE username=$1", [
      username,
    ]);
    if (check.rows.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "用户名已存在" }),
      };
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username,password) VALUES ($1,$2) RETURNING id,username",
      [username, hash],
    );
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "注册成功", user: result.rows[0] }),
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "服务器错误" }),
    };
  }
};
