// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CLBToken
 * @dev CLB Token (BEP-20) for the CryptoLoanBoost lending platform.
 *
 * Minimum $100 collateral, 40% LTV.
 *
 * The owner (backend service wallet) can mint tokens when loans are issued
 * and burn tokens when loans are repaid/settled.
 */
contract CLBToken is ERC20, ERC20Burnable, Ownable {
    uint8 private _decimals;

    // Minters — addresses allowed to mint (backend hot wallet, other contracts)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "CLB: not a minter");
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 initialSupply_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        _decimals = decimals_;
        if (initialSupply_ > 0) {
            _mint(msg.sender, initialSupply_ * (10 ** decimals_));
        }
        minters[msg.sender] = true;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    // ─── Minter Management ───────────────────────────────
    function addMinter(address account) external onlyOwner {
        minters[account] = true;
        emit MinterAdded(account);
    }

    function removeMinter(address account) external onlyOwner {
        minters[account] = false;
        emit MinterRemoved(account);
    }

    // ─── Mint (loan issuance) ────────────────────────────
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
        emit TokensMinted(to, amount, "loan_issue");
    }

    function mintWithReason(address to, uint256 amount, string calldata reason) external onlyMinter {
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    // ─── Burn (loan repayment) ───────────────────────────
    function burnWithReason(uint256 amount, string calldata reason) external {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount, reason);
    }

    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount, "burn_from");
    }
}
