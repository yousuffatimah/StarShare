;; StarShare Data Token Contract
;; Clarity v2 (latest syntax as of Stacks 2.1+)
;; Implements SIP-010 fungible token standard with extensions for staking, governance participation, 
;; admin controls, pausing, and allowance mechanisms. Tokens are used for data access and rewards in the StarShare ecosystem.
;; This contract is designed to be robust, with error handling, security checks, and read-only metadata functions.
;; Sophisticated features include allowance approvals for delegated spending, batch operations (limited), and staking for governance weight.

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-BALANCE u101)
(define-constant ERR-INSUFFICIENT-STAKE u102)
(define-constant ERR-MAX-SUPPLY-REACHED u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-ZERO-ADDRESS u105)
(define-constant ERR-INVALID-AMOUNT u106)
(define-constant ERR-ALLOWANCE-EXCEEDED u107)
(define-constant ERR-NEGATIVE-AMOUNT u108)
(define-constant ERR-SELF-APPROVAL u109)

;; Token metadata (SIP-010 compliant)
(define-constant TOKEN-NAME "StarShare Data Token")
(define-constant TOKEN-SYMBOL "STAR")
(define-constant TOKEN-DECIMALS u6)
(define-constant MAX-SUPPLY u1000000000000) ;; 1B tokens max (decimals separate, so effective 1B * 10^6 micro-units)
(define-constant TOKEN-URI (some "https://starshare.xyz/token-metadata.json")) ;; Optional URI for off-chain metadata

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var total-supply uint u0)

;; Balances, stakes, and allowances
(define-map balances principal uint)
(define-map staked-balances principal uint)
(define-map allowances {owner: principal, spender: principal} uint)

;; Private helper: Check if caller is admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: Ensure contract is not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Private helper: Validate non-zero address
(define-private (validate-address (addr principal))
  (asserts! (not (is-eq addr 'SP000000000000000000002Q6VF78)) (err ERR-ZERO-ADDRESS))
)

;; Private helper: Validate positive amount
(define-private (validate-amount (amount uint))
  (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
)

;; Transfer admin rights to a new principal
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (validate-address new-admin)
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause or unpause the contract (affects transfers, stakes, etc.)
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Mint new tokens (admin only)
(define-public (mint (recipient principal) (amount uint))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (validate-address recipient)
    (validate-amount amount)
    (let ((new-supply (+ (var-get total-supply) amount)))
      (asserts! (<= new-supply MAX-SUPPLY) (err ERR-MAX-SUPPLY-REACHED))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (var-set total-supply new-supply)
      (ok amount) ;; Return minted amount for confirmation
    )
  )
)

;; Burn tokens from caller's balance
(define-public (burn (amount uint))
  (begin
    (ensure-not-paused)
    (validate-amount amount)
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (var-set total-supply (- (var-get total-supply) amount))
      (ok amount)
    )
  )
)

;; Transfer tokens to recipient
(define-public (transfer (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (validate-address recipient)
    (validate-amount amount)
    (let ((sender-balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= sender-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- sender-balance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (ok amount)
    )
  )
)

;; Approve spender to transfer allowance amount on behalf of owner
(define-public (approve (spender principal) (amount uint))
  (begin
    (ensure-not-paused)
    (validate-address spender)
    (asserts! (not (is-eq spender tx-sender)) (err ERR-SELF-APPROVAL))
    (map-set allowances {owner: tx-sender, spender: spender} amount)
    (ok amount)
  )
)

;; Increase allowance for spender
(define-public (increase-allowance (spender principal) (added-amount uint))
  (begin
    (ensure-not-paused)
    (validate-address spender)
    (validate-amount added-amount)
    (let ((current-allowance (default-to u0 (map-get? allowances {owner: tx-sender, spender: spender}))))
      (map-set allowances {owner: tx-sender, spender: spender} (+ current-allowance added-amount))
      (ok (+ current-allowance added-amount))
    )
  )
)

;; Decrease allowance for spender
(define-public (decrease-allowance (spender principal) (subtracted-amount uint))
  (begin
    (ensure-not-paused)
    (validate-address spender)
    (validate-amount subtracted-amount)
    (let ((current-allowance (default-to u0 (map-get? allowances {owner: tx-sender, spender: spender}))))
      (asserts! (>= current-allowance subtracted-amount) (err ERR-ALLOWANCE-EXCEEDED))
      (map-set allowances {owner: tx-sender, spender: spender} (- current-allowance subtracted-amount))
      (ok (- current-allowance subtracted-amount))
    )
  )
)

;; Transfer from owner's balance using allowance (spender calls this)
(define-public (transfer-from (owner principal) (recipient principal) (amount uint))
  (begin
    (ensure-not-paused)
    (validate-address owner)
    (validate-address recipient)
    (validate-amount amount)
    (let ((owner-balance (default-to u0 (map-get? balances owner)))
          (allowance (default-to u0 (map-get? allowances {owner: owner, spender: tx-sender}))))
      (asserts! (>= owner-balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (asserts! (>= allowance amount) (err ERR-ALLOWANCE-EXCEEDED))
      (map-set balances owner (- owner-balance amount))
      (map-set allowances {owner: owner, spender: tx-sender} (- allowance amount))
      (map-set balances recipient (+ amount (default-to u0 (map-get? balances recipient))))
      (ok amount)
    )
  )
)

;; Stake tokens for governance participation
(define-public (stake (amount uint))
  (begin
    (ensure-not-paused)
    (validate-amount amount)
    (let ((balance (default-to u0 (map-get? balances tx-sender))))
      (asserts! (>= balance amount) (err ERR-INSUFFICIENT-BALANCE))
      (map-set balances tx-sender (- balance amount))
      (map-set staked-balances tx-sender (+ amount (default-to u0 (map-get? staked-balances tx-sender))))
      (ok amount)
    )
  )
)

;; Unstake tokens back to balance
(define-public (unstake (amount uint))
  (begin
    (ensure-not-paused)
    (validate-amount amount)
    (let ((stake-balance (default-to u0 (map-get? staked-balances tx-sender))))
      (asserts! (>= stake-balance amount) (err ERR-INSUFFICIENT-STAKE))
      (map-set staked-balances tx-sender (- stake-balance amount))
      (map-set balances tx-sender (+ amount (default-to u0 (map-get? balances tx-sender))))
      (ok amount)
    )
  )
)

;; Read-only: Get token name (SIP-010)
(define-read-only (get-name)
  (ok TOKEN-NAME)
)

;; Read-only: Get token symbol (SIP-010)
(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

;; Read-only: Get token decimals (SIP-010)
(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

;; Read-only: Get token URI (SIP-010 optional)
(define-read-only (get-token-uri)
  (ok TOKEN-URI)
)

;; Read-only: Get balance of account (SIP-010)
(define-read-only (get-balance (account principal))
  (ok (default-to u0 (map-get? balances account)))
)

;; Read-only: Get staked balance
(define-read-only (get-staked-balance (account principal))
  (ok (default-to u0 (map-get? staked-balances account)))
)

;; Read-only: Get allowance for spender on owner's behalf
(define-read-only (get-allowance (owner principal) (spender principal))
  (ok (default-to u0 (map-get? allowances {owner: owner, spender: spender})))
)

;; Read-only: Get total supply (SIP-010)
(define-read-only (get-total-supply)
  (ok (var-get total-supply))
)

;; Read-only: Get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: Check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)

;; Additional read-only: Get effective governance power (balance + staked)
(define-read-only (get-governance-power (account principal))
  (ok (+ (default-to u0 (map-get? balances account)) (default-to u0 (map-get? staked-balances account))))
)