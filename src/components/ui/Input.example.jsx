import React, { useState } from "react";
import Input from "./Input";
import { Search } from "lucide-react";

export default function InputExample() {
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");

  return (
    <div className="space-y-4">
      <Input
        id="reservation-title"
        name="title"
        label="标题"
        value={title}
        onChange={setTitle}
        placeholder="例如：SEM 测试"
        size="md"
        testId="reservation-title"
        leftIcon={Search}
      />

      <Input
        id="user-email"
        name="email"
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="name@lab.edu"
        autoComplete="email"
        size="sm"
        error={email && !email.includes("@") ? "Email 格式不正确" : undefined}
        rightSlot={
          <button
            type="button"
            className="text-xs text-text-secondary hover:text-text-primary"
            onClick={() => setEmail("")}
          >
            清除
          </button>
        }
      />
    </div>
  );
}
