import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { parseEther } from 'ethers/lib/utils'
import { ZERO_ADDRESS } from 'prepo-constants'
import { utils } from 'prepo-hardhat'
import { withdrawHookFixture } from './fixtures/HookFixture'
import { collateralDepositRecordFixture } from './fixtures/CollateralDepositRecordFixture'
import { getWithdrawHookVaultChangedEvent } from './events'
import { CollateralDepositRecord, WithdrawHook } from '../typechain'

const { revertReason } = utils

describe('=> WithdrawHook', () => {
  let withdrawHook: WithdrawHook
  let deployer: SignerWithAddress
  let user: SignerWithAddress
  let vault: SignerWithAddress
  let depositRecord: CollateralDepositRecord
  const TEST_GLOBAL_DEPOSIT_CAP = parseEther('50000')
  const TEST_ACCOUNT_DEPOSIT_CAP = parseEther('50')
  const TEST_AMOUNT_ONE = parseEther('1')
  const TEST_AMOUNT_TWO = parseEther('2')

  beforeEach(async () => {
    ;[deployer, user, vault] = await ethers.getSigners()
    depositRecord = await collateralDepositRecordFixture(
      TEST_GLOBAL_DEPOSIT_CAP,
      TEST_ACCOUNT_DEPOSIT_CAP
    )
    withdrawHook = await withdrawHookFixture(depositRecord.address)
    await depositRecord.connect(deployer).setAllowedHook(user.address, true)
    await depositRecord.connect(deployer).setAllowedHook(withdrawHook.address, true)
  })

  describe('# initialize', () => {
    it('should be initialized with correct values', async () => {
      expect(await withdrawHook.getVault()).to.eq(ZERO_ADDRESS)
      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })
  })

  describe('# hook', () => {
    beforeEach(async () => {
      await withdrawHook.setVault(vault.address)
    })

    it('should only usable by the vault', async () => {
      expect(await withdrawHook.getVault()).to.not.eq(user.address)

      await expect(
        withdrawHook.connect(user).hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)
      ).to.revertedWith(revertReason('Caller is not the vault'))
    })

    it('should update deposit records on the CollateralDepositRecord contract', async () => {
      const testDepositToWithdrawFrom = parseEther('5')
      await depositRecord.connect(user).recordDeposit(user.address, testDepositToWithdrawFrom)
      const globalDepositsBefore = await depositRecord.getGlobalDepositAmount()
      const accountDepositsBefore = await depositRecord.getNetDeposit(user.address)

      await withdrawHook.connect(vault).hook(user.address, TEST_AMOUNT_ONE, TEST_AMOUNT_TWO)

      expect(await depositRecord.getGlobalDepositAmount()).to.eq(
        globalDepositsBefore.sub(TEST_AMOUNT_TWO)
      )
      expect(await depositRecord.getNetDeposit(user.address)).to.eq(
        accountDepositsBefore.sub(TEST_AMOUNT_TWO)
      )
    })
  })

  describe('# setVault', () => {
    it('should only be usable by the owner', async () => {
      await expect(withdrawHook.connect(user).setVault(vault.address)).revertedWith(
        revertReason('Ownable: caller is not the owner')
      )
    })

    it('should be settable to an address', async () => {
      expect(await withdrawHook.getVault()).to.eq(ZERO_ADDRESS)

      await withdrawHook.connect(deployer).setVault(vault.address)

      expect(await withdrawHook.getVault()).to.eq(vault.address)
    })

    it('should be settable to the zero address', async () => {
      await withdrawHook.connect(deployer).setVault(vault.address)
      expect(await withdrawHook.getVault()).to.eq(vault.address)

      await withdrawHook.connect(deployer).setVault(ZERO_ADDRESS)

      expect(await withdrawHook.getVault()).to.eq(ZERO_ADDRESS)
    })

    it('should be settable to the same value twice', async () => {
      expect(await withdrawHook.getVault()).to.eq(ZERO_ADDRESS)

      await withdrawHook.connect(deployer).setVault(vault.address)

      expect(await withdrawHook.getVault()).to.eq(vault.address)

      await withdrawHook.connect(deployer).setVault(vault.address)

      expect(await withdrawHook.getVault()).to.eq(vault.address)
    })

    it('should emit a VaultChanged event', async () => {
      await withdrawHook.connect(deployer).setVault(vault.address)

      const event = await getWithdrawHookVaultChangedEvent(withdrawHook)
      expect(event.vault).to.eq(vault.address)
    })
  })

  describe('# setDepositRecord', () => {
    it('reverts if not owner', async () => {
      expect(await withdrawHook.owner()).to.not.eq(user.address)

      await expect(withdrawHook.connect(user).setDepositRecord(depositRecord.address)).revertedWith(
        revertReason('Ownable: caller is not the owner')
      )
    })

    it('sets to non-zero address', async () => {
      await withdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(depositRecord.address).to.not.eq(ZERO_ADDRESS)
      expect(await withdrawHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })

    it('sets to zero address', async () => {
      expect(await withdrawHook.getDepositRecord()).to.not.eq(ZERO_ADDRESS)

      await withdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)

      expect(await withdrawHook.getDepositRecord()).to.eq(ZERO_ADDRESS)
    })

    it('is idempotent', async () => {
      await withdrawHook.connect(deployer).setDepositRecord(ZERO_ADDRESS)
      expect(await withdrawHook.getDepositRecord()).to.not.eq(depositRecord.address)

      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)

      await withdrawHook.connect(deployer).setDepositRecord(depositRecord.address)

      expect(await withdrawHook.getDepositRecord()).to.eq(depositRecord.address)
    })
  })
})
