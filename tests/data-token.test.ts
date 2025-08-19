import { describe, it, expect, beforeEach } from "vitest";

interface MockContract {
  admin: string;
  paused: boolean;
  totalSupply: bigint;
  balances: Map<string, bigint>;
  stakedBalances: Map<string, bigint>;
  allowances: Map<string, bigint>; // Key as `${owner}:${spender}`
  MAX_SUPPLY: bigint;

  isAdmin(caller: string): boolean;
  validateAddress(addr: string): { error?: number } | undefined;
  validateAmount(amount: bigint): { error?: number } | undefined;
  transferAdmin(caller: string, newAdmin: string): { value: boolean; error?: number };
  setPaused(caller: string, pause: boolean): { value: boolean; error?: number };
  mint(caller: string, recipient: string, amount: bigint): { value: bigint; error?: number };
  burn(caller: string, amount: bigint): { value: bigint; error?: number };
  transfer(caller: string, recipient: string, amount: bigint): { value: bigint; error?: number };
  approve(caller: string, spender: string, amount: bigint): { value: bigint; error?: number };
  increaseAllowance(caller: string, spender: string, addedAmount: bigint): { value: bigint; error?: number };
  decreaseAllowance(caller: string, spender: string, subtractedAmount: bigint): { value: bigint; error?: number };
  transferFrom(caller: string, owner: string, recipient: string, amount: bigint): { value: bigint; error?: number };
  stake(caller: string, amount: bigint): { value: bigint; error?: number };
  unstake(caller: string, amount: bigint): { value: bigint; error?: number };
}

const mockContract: MockContract = {
  admin: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
  paused: false,
  totalSupply: 0n,
  balances: new Map<string, bigint>(),
  stakedBalances: new Map<string, bigint>(),
  allowances: new Map<string, bigint>(),
  MAX_SUPPLY: 1_000_000_000_000n,

  isAdmin(caller: string): boolean {
    return caller === this.admin;
  },

  validateAddress(addr: string): { error?: number } | undefined {
    if (addr === "SP000000000000000000002Q6VF78") return { error: 105 };
    return undefined;
  },

  validateAmount(amount: bigint): { error?: number } | undefined {
    if (amount <= 0n) return { error: 106 };
    return undefined;
  },

  transferAdmin(caller: string, newAdmin: string): { value: boolean; error?: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    const validation = this.validateAddress(newAdmin);
    if (validation?.error) return validation;
    this.admin = newAdmin;
    return { value: true };
  },

  setPaused(caller: string, pause: boolean): { value: boolean; error?: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    this.paused = pause;
    return { value: pause };
  },

  mint(caller: string, recipient: string, amount: bigint): { value: bigint; error?: number } {
    if (!this.isAdmin(caller)) return { error: 100 };
    const addrValidation = this.validateAddress(recipient);
    if (addrValidation?.error) return addrValidation;
    const amtValidation = this.validateAmount(amount);
    if (amtValidation?.error) return amtValidation;
    if (this.totalSupply + amount > this.MAX_SUPPLY) return { error: 103 };
    this.balances.set(recipient, (this.balances.get(recipient) ?? 0n) + amount);
    this.totalSupply += amount;
    return { value: amount };
  },

  burn(caller: string, amount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const amtValidation = this.validateAmount(amount);
    if (amtValidation?.error) return amtValidation;
    const balance = this.balances.get(caller) ?? 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.totalSupply -= amount;
    return { value: amount };
  },

  transfer(caller: string, recipient: string, amount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const addrValidation = this.validateAddress(recipient);
    if (addrValidation?.error) return addrValidation;
    const amtValidation = this.validateAmount(amount);
    if (amtValidation?.error) return amtValidation;
    const balance = this.balances.get(caller) ?? 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.balances.set(recipient, (this.balances.get(recipient) ?? 0n) + amount);
    return { value: amount };
  },

  approve(caller: string, spender: string, amount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const addrValidation = this.validateAddress(spender);
    if (addrValidation?.error) return addrValidation;
    if (spender === caller) return { error: 109 };
    const key = `${caller}:${spender}`;
    this.allowances.set(key, amount);
    return { value: amount };
  },

  increaseAllowance(caller: string, spender: string, addedAmount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const addrValidation = this.validateAddress(spender);
    if (addrValidation?.error) return addrValidation;
    const amtValidation = this.validateAmount(addedAmount);
    if (amtValidation?.error) return amtValidation;
    const key = `${caller}:${spender}`;
    const current = this.allowances.get(key) ?? 0n;
    const newAllowance = current + addedAmount;
    this.allowances.set(key, newAllowance);
    return { value: newAllowance };
  },

  decreaseAllowance(caller: string, spender: string, subtractedAmount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const addrValidation = this.validateAddress(spender);
    if (addrValidation?.error) return addrValidation;
    const amtValidation = this.validateAmount(subtractedAmount);
    if (amtValidation?.error) return amtValidation;
    const key = `${caller}:${spender}`;
    const current = this.allowances.get(key) ?? 0n;
    if (current < subtractedAmount) return { error: 107 };
    const newAllowance = current - subtractedAmount;
    this.allowances.set(key, newAllowance);
    return { value: newAllowance };
  },

  transferFrom(caller: string, owner: string, recipient: string, amount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const ownerValidation = this.validateAddress(owner);
    if (ownerValidation?.error) return ownerValidation;
    const recipValidation = this.validateAddress(recipient);
    if (recipValidation?.error) return recipValidation;
    const amtValidation = this.validateAmount(amount);
    if (amtValidation?.error) return amtValidation;
    const ownerBalance = this.balances.get(owner) ?? 0n;
    if (ownerBalance < amount) return { error: 101 };
    const key = `${owner}:${caller}`;
    const allowance = this.allowances.get(key) ?? 0n;
    if (allowance < amount) return { error: 107 };
    this.balances.set(owner, ownerBalance - amount);
    this.allowances.set(key, allowance - amount);
    this.balances.set(recipient, (this.balances.get(recipient) ?? 0n) + amount);
    return { value: amount };
  },

  stake(caller: string, amount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const amtValidation = this.validateAmount(amount);
    if (amtValidation?.error) return amtValidation;
    const balance = this.balances.get(caller) ?? 0n;
    if (balance < amount) return { error: 101 };
    this.balances.set(caller, balance - amount);
    this.stakedBalances.set(caller, (this.stakedBalances.get(caller) ?? 0n) + amount);
    return { value: amount };
  },

  unstake(caller: string, amount: bigint): { value: bigint; error?: number } {
    if (this.paused) return { error: 104 };
    const amtValidation = this.validateAmount(amount);
    if (amtValidation?.error) return amtValidation;
    const stakeBalance = this.stakedBalances.get(caller) ?? 0n;
    if (stakeBalance < amount) return { error: 102 };
    this.stakedBalances.set(caller, stakeBalance - amount);
    this.balances.set(caller, (this.balances.get(caller) ?? 0n) + amount);
    return { value: amount };
  },
};

describe("StarShare Data Token Contract", () => {
  beforeEach(() => {
    mockContract.admin = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    mockContract.paused = false;
    mockContract.totalSupply = 0n;
    mockContract.balances = new Map();
    mockContract.stakedBalances = new Map();
    mockContract.allowances = new Map();
  });

  it("should allow admin to transfer admin rights", () => {
    const result = mockContract.transferAdmin(mockContract.admin, "STNEWADMIN123");
    expect(result).toEqual({ value: true });
    expect(mockContract.admin).toBe("STNEWADMIN123");
  });

  it("should prevent non-admin from transferring admin rights", () => {
    const result = mockContract.transferAdmin("STOTHER", "STNEWADMIN123");
    expect(result).toEqual({ error: 100 });
  });

  it("should mint tokens when called by admin", () => {
    const result = mockContract.mint(mockContract.admin, "STUSER1", 1000n);
    expect(result).toEqual({ value: 1000n });
    expect(mockContract.balances.get("STUSER1")).toBe(1000n);
    expect(mockContract.totalSupply).toBe(1000n);
  });

  it("should prevent minting over max supply", () => {
    const result = mockContract.mint(mockContract.admin, "STUSER1", 2_000_000_000_000n);
    expect(result).toEqual({ error: 103 });
  });

  it("should prevent minting with invalid amount", () => {
    const result = mockContract.mint(mockContract.admin, "STUSER1", 0n);
    expect(result).toEqual({ error: 106 });
  });

  it("should burn tokens from caller", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    const result = mockContract.burn("STUSER1", 200n);
    expect(result).toEqual({ value: 200n });
    expect(mockContract.balances.get("STUSER1")).toBe(300n);
    expect(mockContract.totalSupply).toBe(300n);
  });

  it("should prevent burning more than balance", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    const result = mockContract.burn("STUSER1", 600n);
    expect(result).toEqual({ error: 101 });
  });

  it("should transfer tokens between users", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    const result = mockContract.transfer("STUSER1", "STUSER2", 200n);
    expect(result).toEqual({ value: 200n });
    expect(mockContract.balances.get("STUSER1")).toBe(300n);
    expect(mockContract.balances.get("STUSER2")).toBe(200n);
  });

  it("should prevent transfer when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.transfer("STUSER1", "STUSER2", 200n);
    expect(result).toEqual({ error: 104 });
  });

  it("should approve allowance for spender", () => {
    const result = mockContract.approve("STOWNER", "STSPENDER", 300n);
    expect(result).toEqual({ value: 300n });
    expect(mockContract.allowances.get("STOWNER:STSPENDER")).toBe(300n);
  });

  it("should prevent self-approval", () => {
    const result = mockContract.approve("STOWNER", "STOWNER", 300n);
    expect(result).toEqual({ error: 109 });
  });

  it("should increase allowance", () => {
    mockContract.approve("STOWNER", "STSPENDER", 300n);
    const result = mockContract.increaseAllowance("STOWNER", "STSPENDER", 200n);
    expect(result).toEqual({ value: 500n });
    expect(mockContract.allowances.get("STOWNER:STSPENDER")).toBe(500n);
  });

  it("should decrease allowance", () => {
    mockContract.approve("STOWNER", "STSPENDER", 300n);
    const result = mockContract.decreaseAllowance("STOWNER", "STSPENDER", 100n);
    expect(result).toEqual({ value: 200n });
    expect(mockContract.allowances.get("STOWNER:STSPENDER")).toBe(200n);
  });

  it("should prevent decreasing below zero allowance", () => {
    mockContract.approve("STOWNER", "STSPENDER", 300n);
    const result = mockContract.decreaseAllowance("STOWNER", "STSPENDER", 400n);
    expect(result).toEqual({ error: 107 });
  });

  it("should transfer from using allowance", () => {
    mockContract.mint(mockContract.admin, "STOWNER", 500n);
    mockContract.approve("STOWNER", "STSPENDER", 300n);
    const result = mockContract.transferFrom("STSPENDER", "STOWNER", "STRECIP", 200n);
    expect(result).toEqual({ value: 200n });
    expect(mockContract.balances.get("STOWNER")).toBe(300n);
    expect(mockContract.balances.get("STRECIP")).toBe(200n);
    expect(mockContract.allowances.get("STOWNER:STSPENDER")).toBe(100n);
  });

  it("should prevent transfer-from exceeding allowance", () => {
    mockContract.mint(mockContract.admin, "STOWNER", 500n);
    mockContract.approve("STOWNER", "STSPENDER", 300n);
    const result = mockContract.transferFrom("STSPENDER", "STOWNER", "STRECIP", 400n);
    expect(result).toEqual({ error: 107 });
  });

  it("should stake tokens", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    const result = mockContract.stake("STUSER1", 200n);
    expect(result).toEqual({ value: 200n });
    expect(mockContract.balances.get("STUSER1")).toBe(300n);
    expect(mockContract.stakedBalances.get("STUSER1")).toBe(200n);
  });

  it("should prevent staking more than balance", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    const result = mockContract.stake("STUSER1", 600n);
    expect(result).toEqual({ error: 101 });
  });

  it("should unstake tokens", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    mockContract.stake("STUSER1", 200n);
    const result = mockContract.unstake("STUSER1", 100n);
    expect(result).toEqual({ value: 100n });
    expect(mockContract.stakedBalances.get("STUSER1")).toBe(100n);
    expect(mockContract.balances.get("STUSER1")).toBe(400n);
  });

  it("should prevent unstaking more than staked", () => {
    mockContract.mint(mockContract.admin, "STUSER1", 500n);
    mockContract.stake("STUSER1", 200n);
    const result = mockContract.unstake("STUSER1", 300n);
    expect(result).toEqual({ error: 102 });
  });

  it("should prevent staking when paused", () => {
    mockContract.setPaused(mockContract.admin, true);
    const result = mockContract.stake("STUSER1", 100n);
    expect(result).toEqual({ error: 104 });
  });
});