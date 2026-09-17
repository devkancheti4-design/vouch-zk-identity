// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {Groth16Verifier} from "../contracts/Groth16Verifier.sol";
import {VouchRegistry, IGroth16Verifier} from "../contracts/VouchRegistry.sol";

/// @notice Drives the registry with a REAL Groth16 proof produced by circuits/gen-fixture.mjs
///         against the compiled circuit. Nothing here is mocked: the pairing check runs.
contract VouchRegistryTest is Test {
    Groth16Verifier g;
    VouchRegistry reg;
    address admin = makeAddr("admin");
    address alice = makeAddr("alice");
    address mallory = makeAddr("mallory");

    uint256 constant ISSUER_X = 16256427309067318996113477331037527797444329102066601306330596369324314410467;
    uint256 constant ISSUER_Y = 5404833324877437496892341675876228763119597194797211767738034807954009477490;
    uint64 constant MIN_AGE = 6570;
    uint256 constant NOW_DAYS = 20713;

    uint256[2] A = [0x2803f93c946a7ea8e7c3a4e287901e7f9e20a67d60f2bbce342c97e5db2a3a70, 0x01d9a3ce0b350d7635407e71623d75cf158bb29d859c789400e560c880fbc28f];
    uint256[2][2] B = [[0x128f2c6ea966ce8ee80b59401019d8194b59b05519c560da42407ec1373ad10c, 0x15c44c900a3b0f6fefaa7decaaa04aa48608b7c5f71fdfbf73ebee6e5c652f12], [0x0dac19301e5ef0cf7f3508622e4f71b35e0853f1a3010ed37cae3735f1cd7dd1, 0x15ce61b5c88a445a2867e7d394ac89f901048c495e486c1ce45db9c0cd8dc9a4]];
    uint256[2] C = [0x1c835d7a584193e76c441616646bfa0d687502a28e5604144fbfc2260aadbe15, 0x0f875471deb096a8a37c93de79f1a9e2b9a917057110104368edf84e466205cc];
    uint256[10] PUB = [0x21257aed8ccef5b0be3dfe4062f1fba4f5cd751b2bcf35de43b7fa28dfed608b, 0x23f0cfd1a144b56e0f7ff55c52c641ccb75154ce3e5e6f4fc61f91d9cddb3de3, 0x0bf306fa1ee9f4825ad9dce704b79559e6e543f7ade6b84d91c70ea560bfd172, 0x00000000000000000000000000000000000000000000000000000000000050e9, 0x00000000000000000000000000000000000000000000000000000000000019aa, 0x0000000000000000000000000000000000000000000000000000000000000000, 0x0000000000000000000000000000000000000000000000000000000000000001, 0x0000000000000000000000000000000000000000000000000000000000000000, 0x0000000000000000000000000000000000000000000000000000000000000000, 0x0000000000000000000000000000000000000000000000000000000000000001];

    uint256 policyId;

    function setUp() public {
        // the chain's clock must agree with the day the proof asserts
        vm.warp(NOW_DAYS * 86400 + 3600);
        g = new Groth16Verifier();
        reg = new VouchRegistry(admin, IGroth16Verifier(address(g)));
        vm.prank(admin);
        policyId = reg.publishPolicy(VouchRegistry.Policy({
            name: "Over 18", issuerPubX: ISSUER_X, issuerPubY: ISSUER_Y,
            minAgeDays: MIN_AGE, minBalance: 0,
            requireAge: true, requireBalance: false, requireAccredited: false,
            maxClockSkewDays: 2, active: true
        }));
        assertEq(policyId, 1);
    }

    function test_TheVerifierAcceptsARealProof() public view {
        assertTrue(g.verifyProof(A, B, C, PUB), "real Groth16 proof accepted");
    }

    function test_ClearRecordsABooleanAndNothingElse() public {
        uint256 gas0 = gasleft();
        vm.prank(alice);
        reg.clear(policyId, A, B, C, PUB);
        console.log("GAS clear() incl. pairing check", gas0 - gasleft());
        assertTrue(reg.isCleared(alice, policyId));
        assertTrue(reg.spent(PUB[0]), "the nullifier is burned");
        assertEq(reg.clearedCount(policyId), 1);
        // there is no getter for anything else, because nothing else was stored
    }

    function test_TheSameNullifierCannotBeUsedTwice() public {
        vm.prank(alice);
        reg.clear(policyId, A, B, C, PUB);
        vm.prank(mallory); // a different address, the same proof
        vm.expectRevert(VouchRegistry.NullifierSpent.selector);
        reg.clear(policyId, A, B, C, PUB);
        assertFalse(reg.isCleared(mallory, policyId), "a replayed proof clears nobody");
    }

    function test_AProofForAWeakerPolicyIsRefused() public {
        vm.prank(admin);
        uint256 strict = reg.publishPolicy(VouchRegistry.Policy({
            name: "Over 18 and rich", issuerPubX: ISSUER_X, issuerPubY: ISSUER_Y,
            minAgeDays: MIN_AGE, minBalance: 1_000_000,
            requireAge: true, requireBalance: true, requireAccredited: false,
            maxClockSkewDays: 2, active: true
        }));
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(VouchRegistry.PolicyMismatch.selector, "context"));
        reg.clear(strict, A, B, C, PUB);
    }

    function test_AProofFromAnotherIssuerIsRefused() public {
        vm.prank(admin);
        uint256 other = reg.publishPolicy(VouchRegistry.Policy({
            name: "Other issuer", issuerPubX: 12345, issuerPubY: 67890,
            minAgeDays: MIN_AGE, minBalance: 0,
            requireAge: true, requireBalance: false, requireAccredited: false,
            maxClockSkewDays: 2, active: true
        }));
        uint256[10] memory pub = PUB;
        pub[9] = other; // claim the other policy's context
        vm.prank(alice);
        vm.expectRevert(VouchRegistry.WrongIssuer.selector);
        reg.clear(other, A, B, C, pub);
    }

    function test_AStaleClockIsRefused() public {
        vm.warp((NOW_DAYS + 5) * 86400);
        vm.prank(alice);
        vm.expectRevert(VouchRegistry.ClockOutOfRange.selector);
        reg.clear(policyId, A, B, C, PUB);
    }

    function test_ATamperedPublicSignalBreaksThePairingCheck() public {
        uint256[10] memory pub = PUB;
        pub[4] = uint256(MIN_AGE) - 1; // try to read the proof as a weaker age claim
        vm.prank(admin);
        uint256 weaker = reg.publishPolicy(VouchRegistry.Policy({
            name: "Weaker", issuerPubX: ISSUER_X, issuerPubY: ISSUER_Y,
            minAgeDays: MIN_AGE - 1, minBalance: 0,
            requireAge: true, requireBalance: false, requireAccredited: false,
            maxClockSkewDays: 2, active: true
        }));
        pub[9] = weaker;
        vm.prank(alice);
        vm.expectRevert(VouchRegistry.ProofInvalid.selector);
        reg.clear(weaker, A, B, C, pub);
    }

    function test_OneAddressClearsOnce() public {
        vm.prank(alice);
        reg.clear(policyId, A, B, C, PUB);
        vm.prank(alice);
        vm.expectRevert(VouchRegistry.AlreadyCleared.selector);
        reg.clear(policyId, A, B, C, PUB);
    }

    function test_OnlyAdminPublishes() public {
        vm.prank(mallory);
        vm.expectRevert();
        reg.publishPolicy(VouchRegistry.Policy({
            name: "x", issuerPubX: 1, issuerPubY: 1, minAgeDays: 0, minBalance: 0,
            requireAge: false, requireBalance: false, requireAccredited: false,
            maxClockSkewDays: 1, active: true
        }));
    }

    function test_RetiredPolicyRefuses() public {
        vm.prank(admin);
        reg.retirePolicy(policyId);
        vm.prank(alice);
        vm.expectRevert(VouchRegistry.PolicyInactive.selector);
        reg.clear(policyId, A, B, C, PUB);
    }
}
