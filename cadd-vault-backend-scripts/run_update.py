#!/usr/bin/env python3
"""
Simple wrapper script for running database updates with a simplified interface.

This script provides a streamlined menu for running the update_database.py script
with the most common options: dry run mode, package limits, and the ability to
process all packages in the database. It handles the command line arguments so
users don't need to remember all the options.
"""

import subprocess
import sys
from pathlib import Path

def run_command(args):
    """Run the update_database.py script with given arguments."""
    script_path = Path(__file__).parent / "update_database.py"
    cmd = [sys.executable, str(script_path)] + args
    
    print(f"Running: {' '.join(cmd)}")
    print("-" * 50)
    
    try:
        result = subprocess.run(cmd, check=True)
        return result.returncode
    except subprocess.CalledProcessError as e:
        print(f"Command failed with exit code {e.returncode}")
        return e.returncode
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        return 130

def main():
    """Main function with simplified command options."""
    print("CADD Vault Database Update Tool")
    print("=" * 40)
    print()
    print("Choose an option:")
    print("1. Dry run - 10 packages")
    print("2. Dry run - 100 packages")
    print("3. Dry run - ALL packages")
    print("4. Live update - 10 packages (careful!)")
    print("5. Live update - 100 packages (careful!)")
    print("6. Live update - ALL packages (very careful!)")
    print("7. Custom command")
    print("8. Exit")
    print()
    
    while True:
        try:
            choice = input("Enter your choice (1-8): ").strip()
            
            if choice == "1":
                return run_command([
                    "--dry-run", "--limit", "10", "--verbose"
                ])
            
            elif choice == "2":
                return run_command([
                    "--dry-run", "--limit", "100", "--verbose"
                ])
            
            elif choice == "3":
                return run_command([
                    "--dry-run", "--all", "--verbose"
                ])
            
            elif choice == "4":
                confirm = input("This will make LIVE changes to the database. Are you sure? (yes/no): ")
                if confirm.lower() == "yes":
                    return run_command([
                        "--limit", "10", "--verbose"
                    ])
                else:
                    print("Operation cancelled.")
                    continue
            
            elif choice == "5":
                confirm = input("This will make LIVE changes to the database. Are you sure? (yes/no): ")
                if confirm.lower() == "yes":
                    return run_command([
                        "--limit", "100", "--verbose"
                    ])
                else:
                    print("Operation cancelled.")
                    continue
            
            elif choice == "6":
                confirm = input("This will make LIVE changes to ALL packages in the database. Are you absolutely sure? (yes/no): ")
                if confirm.lower() == "yes":
                    double_confirm = input("This is a major operation. Type 'CONFIRM' to proceed: ")
                    if double_confirm == "CONFIRM":
                        return run_command([
                            "--all", "--verbose"
                        ])
                    else:
                        print("Operation cancelled.")
                        continue
                else:
                    print("Operation cancelled.")
                    continue
            
            elif choice == "7":
                print("\nCustom command options:")
                print("--dry-run       # Run without making changes")
                print("--limit N       # Process N packages")
                print("--all           # Process ALL packages")
                print("--verbose       # Verbose logging")
                print()
                
                custom_args = input("Enter custom arguments: ").strip().split()
                if custom_args:
                    return run_command(custom_args)
                else:
                    print("No arguments provided.")
                    continue
            
            elif choice == "8":
                print("Goodbye!")
                return 0
            
            else:
                print("Invalid choice. Please enter 1-8.")
                continue
                
        except KeyboardInterrupt:
            print("\nGoodbye!")
            return 130
        except EOFError:
            print("\nGoodbye!")
            return 0

if __name__ == "__main__":
    sys.exit(main())
