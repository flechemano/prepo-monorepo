import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import { AccountAccessController, MockAccountAccessController } from '../../typechain'

export async function accountAccessControllerFixture(): Promise<AccountAccessController> {
  const accountAccessController = await ethers.getContractFactory('AccountAccessController')
  return (await accountAccessController.deploy()) as unknown as AccountAccessController
}

export async function mockAccountAccessControllerFixture(): Promise<MockAccountAccessController> {
  const mockAccountAccessController = await ethers.getContractFactory('MockAccountAccessController')
  return (await mockAccountAccessController.deploy()) as unknown as MockAccountAccessController
}

export async function smockAccountAccessControllerFixture(): Promise<MockContract> {
  const smockAccountAccessControllerFactory = await smock.mock('AccountAccessController')
  return smockAccountAccessControllerFactory.deploy()
}
