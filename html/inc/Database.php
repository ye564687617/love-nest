<?php
// PDO 单例
class Database
{
    private static ?self $instance = null;
    private PDO $pdo;

    private function __construct(array $cfg)
    {
        $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $cfg['host'], $cfg['port'] ?? 3306, $cfg['name']);
        $this->pdo = new PDO($dsn, $cfg['user'], $cfg['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    public static function get(array $cfg): self
    {
        if (self::$instance === null) {
            self::$instance = new self($cfg);
        }
        return self::$instance;
    }

    public function query(string $sql, array $params = []): PDOStatement
    {
        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $key => $value) {
            $type = is_int($value) ? PDO::PARAM_INT : (is_bool($value) ? PDO::PARAM_BOOL : ($value === null ? PDO::PARAM_NULL : PDO::PARAM_STR));
            $stmt->bindValue(is_int($key) ? $key + 1 : ':' . ltrim($key, ':'), $value, $type);
        }
        $stmt->execute();
        return $stmt;
    }

    public function transaction(callable $callback): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $callback($this);
            $this->pdo->commit();
            return $result;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    public function fetch(string $sql, array $params = []): ?array
    {
        $r = $this->query($sql, $params)->fetch();
        return $r === false ? null : $r;
    }

    public function fetchAll(string $sql, array $params = []): array
    {
        return $this->query($sql, $params)->fetchAll();
    }

    public function fetchColumn(string $sql, array $params = []): mixed
    {
        return $this->query($sql, $params)->fetchColumn();
    }

    public function insert(string $table, array $data): int
    {
        $cols = array_keys($data);
        $placeholders = array_map(fn($c) => ':' . $c, $cols);
        $sql = sprintf(
            'INSERT INTO `%s` (`%s`) VALUES (%s)',
            $table, implode('`,`', $cols), implode(',', $placeholders)
        );
        $this->query($sql, $data);
        return (int)$this->pdo->lastInsertId();
    }

    public function lastInsertId(): int
    {
        return (int)$this->pdo->lastInsertId();
    }

    public function update(string $table, array $data, string $where, array $params = []): int
    {
        $sets = [];
        foreach ($data as $k => $v) {
            $sets[] = "`$k` = :set_$k";
            $params["set_$k"] = $v;
        }
        $sql = sprintf('UPDATE `%s` SET %s WHERE %s', $table, implode(',', $sets), $where);
        return $this->query($sql, $params)->rowCount();
    }

    public function delete(string $table, string $where, array $params = []): int
    {
        $sql = sprintf('DELETE FROM `%s` WHERE %s', $table, $where);
        return $this->query($sql, $params)->rowCount();
    }
}
