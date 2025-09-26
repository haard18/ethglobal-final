#!/usr/bin/env python3
"""
Blockchain Wallet Monitor with Voice Announcements
This script monitors Ethereum wallets for transactions and speaks out the activities.
"""

import asyncio
import sys
from gpt.config import Config
from blockchain.wallet_monitor import WalletMonitor
from output.text_to_speech import TextToSpeech

class VoiceWalletMonitor:
    def __init__(self):
        self.config = Config()
        self.tts = TextToSpeech()
        self.monitor = WalletMonitor(
            rpc_url=self.config.ethereum_rpc_url,
            etherscan_api_key=self.config.etherscan_api_key,
            tts_callback=self.tts.speak
        )
        
    def add_default_wallets(self):
        """Add any default wallets from config"""
        for address, nickname in self.config.default_wallets.items():
            self.monitor.add_wallet(address, nickname)
    
    def add_wallet_interactive(self):
        """Interactive wallet addition"""
        print("\n=== Add Wallet to Monitor ===")
        address = input("Enter wallet address (0x...): ").strip()
        nickname = input("Enter nickname (optional): ").strip()
        
        try:
            self.monitor.add_wallet(address, nickname if nickname else None)
            return True
        except ValueError as e:
            print(f"Error: {e}")
            return False
    
    def remove_wallet_interactive(self):
        """Interactive wallet removal"""
        wallets = self.monitor.list_monitored_wallets()
        if not wallets:
            print("No wallets are currently being monitored.")
            return
        
        print("\n=== Currently Monitored Wallets ===")
        for i, wallet in enumerate(wallets, 1):
            print(f"{i}. {wallet}")
        
        try:
            choice = int(input("Enter wallet number to remove (0 to cancel): "))
            if choice == 0:
                return
            
            if 1 <= choice <= len(wallets):
                # Extract address from the wallet string (it's the part in parentheses)
                wallet_str = wallets[choice - 1]
                address_part = wallet_str.split('(')[1].split(')')[0]
                # Convert short address back to full address - we need to store full addresses
                for addr in self.monitor.monitored_addresses.keys():
                    if addr.startswith('0x' + address_part.replace('...', '').replace('0x', '')):
                        self.monitor.remove_wallet(addr)
                        break
            else:
                print("Invalid selection.")
        except (ValueError, IndexError):
            print("Invalid input.")
    
    def show_menu(self):
        """Display interactive menu"""
        while True:
            print("\n" + "="*50)
            print("🔊 BLOCKCHAIN WALLET MONITOR")
            print("="*50)
            
            wallets = self.monitor.list_monitored_wallets()
            if wallets:
                print(f"Currently monitoring {len(wallets)} wallet(s):")
                for wallet in wallets:
                    print(f"  • {wallet}")
            else:
                print("No wallets being monitored.")
            
            print("\nOptions:")
            print("1. Add wallet to monitor")
            print("2. Remove wallet from monitoring")
            print("3. Start monitoring (voice announcements)")
            print("4. Get wallet summary")
            print("5. Exit")
            
            choice = input("\nSelect option (1-5): ").strip()
            
            if choice == '1':
                self.add_wallet_interactive()
            elif choice == '2':
                self.remove_wallet_interactive()
            elif choice == '3':
                if not self.monitor.monitored_addresses:
                    print("Please add at least one wallet before starting monitoring.")
                    continue
                print("\nStarting monitoring... Press Ctrl+C to stop.")
                return True  # Start monitoring
            elif choice == '4':
                self.show_wallet_summaries()
            elif choice == '5':
                print("Goodbye!")
                return False  # Exit
            else:
                print("Invalid option. Please try again.")
    
    def show_wallet_summaries(self):
        """Show current wallet summaries"""
        if not self.monitor.monitored_addresses:
            print("No wallets to show.")
            return
        
        print("\n=== Wallet Summaries ===")
        for address in self.monitor.monitored_addresses.keys():
            summary = self.monitor.get_wallet_summary(address)
            print(f"• {summary}")
            self.tts.speak(summary)
    
    async def run(self):
        """Main run method"""
        print("🚀 Blockchain Voice Monitor Starting...")
        self.tts.speak("Blockchain Voice Monitor Starting")
        
        # Add default wallets if any
        self.add_default_wallets()
        
        # Show interactive menu
        should_monitor = self.show_menu()
        
        if should_monitor:
            try:
                # Start monitoring with voice announcements
                await self.monitor.monitor_wallets(check_interval=15)  # Check every 15 seconds
            except KeyboardInterrupt:
                print("\n\nMonitoring stopped by user.")
                self.tts.speak("Monitoring stopped")

def main():
    """Main entry point"""
    if len(sys.argv) > 1 and sys.argv[1] == '--add-wallet':
        # Quick add wallet mode
        if len(sys.argv) < 3:
            print("Usage: python monitor.py --add-wallet <address> [nickname]")
            return
        
        address = sys.argv[2]
        nickname = sys.argv[3] if len(sys.argv) > 3 else None
        
        monitor_app = VoiceWalletMonitor()
        try:
            monitor_app.monitor.add_wallet(address, nickname)
            print(f"Added wallet: {address}")
        except ValueError as e:
            print(f"Error: {e}")
        return
    
    # Interactive mode
    monitor_app = VoiceWalletMonitor()
    
    try:
        asyncio.run(monitor_app.run())
    except KeyboardInterrupt:
        print("\nExiting...")

if __name__ == "__main__":
    main()