// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {StockbackFixture} from "./utils/StockbackFixture.sol";
import {BrandVaultFactory} from "../src/BrandVaultFactory.sol";
import {BrandVault} from "../src/BrandVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract BrandVaultFactoryTest is StockbackFixture {
    function test_create_registersAndEmits() public {
        vm.prank(owner);
        address v = factory.createVault(SBUX, mNKE, "sbSBUX", "sbSBUX");
        assertEq(factory.vaultOf(SBUX), v);
        assertEq(factory.brandCount(), 2);
        assertEq(factory.brandIds(1), SBUX);
        assertEq(BrandVault(v).brandId(), SBUX);
    }

    function test_address_isDeterministicCreate2() public {
        bytes memory init = abi.encodePacked(
            type(BrandVault).creationCode, abi.encode(IERC20(address(mNKE)), SBUX, "sbSBUX", "sbSBUX")
        );
        address predicted = vm.computeCreate2Address(SBUX, keccak256(init), address(factory));
        vm.prank(owner);
        assertEq(factory.createVault(SBUX, mNKE, "sbSBUX", "sbSBUX"), predicted);
    }

    function test_duplicate_reverts() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(BrandVaultFactory.VaultExists.selector, NIKE));
        factory.createVault(NIKE, mNKE, "x", "x");
    }

    function test_badInputs_revert() public {
        vm.startPrank(owner);
        vm.expectRevert(BrandVaultFactory.BadBrand.selector);
        factory.createVault(0, mNKE, "x", "x");
        vm.expectRevert(BrandVaultFactory.BadBrand.selector);
        factory.createVault(SBUX, IERC20(address(0)), "x", "x");
        vm.stopPrank();
    }

    // 19. unauthorized vault creation
    function test_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        factory.createVault(SBUX, mNKE, "x", "x");
    }
}
