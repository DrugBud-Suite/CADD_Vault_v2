#!/usr/bin/env python3
"""
Test runner for CADD Vault database update integration tests.
Provides easy commands to run different types of tests.
"""

import argparse
import sys
import os
import subprocess
from pathlib import Path

def run_command(cmd, description):
    """Run a command and handle the output"""
    print(f"🔄 {description}")
    print(f"   Command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        
        if result.returncode == 0:
            print(f"✅ {description} - SUCCESS")
            if result.stdout.strip():
                print("   Output:", result.stdout.strip())
            return True
        else:
            print(f"❌ {description} - FAILED")
            if result.stderr.strip():
                print("   Error:", result.stderr.strip())
            if result.stdout.strip():
                print("   Output:", result.stdout.strip())
            return False
            
    except Exception as e:
        print(f"❌ {description} - EXCEPTION: {e}")
        return False

def check_environment():
    """Check if the environment is properly set up"""
    print("🔍 Checking environment setup...")
    
    # Check if .env file exists
    env_file = Path('.env')
    if not env_file.exists():
        print("❌ .env file not found")
        print("   Please create .env file with required environment variables")
        return False
    
    # Check required environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    required_vars = [
        'VITE_SUPABASE_URL',
        'VITE_SUPABASE_ANON_KEY',
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.environ.get(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        return False
    
    # Test database connection
    try:
        from supabase import create_client
        client = create_client(
            os.environ.get('VITE_SUPABASE_URL'),
            os.environ.get('VITE_SUPABASE_ANON_KEY')
        )
        response = client.table('packages').select('id').limit(1).execute()
        if response.data is not None:
            print("✅ Database connection successful")
        else:
            print("❌ Database connection failed")
            return False
    except Exception as e:
        print(f"❌ Database connection error: {e}")
        return False
    
    print("✅ Environment setup looks good")
    return True

def run_tests(test_type="all", verbose=False, html_report=False):
    """Run the integration tests"""
    if not check_environment():
        return False
    
    cmd = ["python", "-m", "pytest", "tests_integration.py"]
    
    if verbose:
        cmd.append("-v")
    else:
        cmd.extend(["-q", "--tb=short"])
    
    if html_report:
        cmd.extend(["--html=test-report.html", "--self-contained-html"])
    
    # Add markers based on test type
    if test_type == "quick":
        cmd.extend(["-m", "not slow"])
    elif test_type == "api":
        cmd.extend(["-m", "api"])
    
    # Add JUnit XML for CI
    cmd.extend(["--junitxml=test-results.xml"])
    
    success = run_command(cmd, f"Running {test_type} integration tests")
    
    if html_report and Path("test-report.html").exists():
        print(f"📊 HTML test report generated: test-report.html")
    
    return success

def install_dependencies():
    """Install test dependencies"""
    cmd = ["pip", "install", "-r", "requirements.txt"]
    return run_command(cmd, "Installing dependencies")

def main():
    parser = argparse.ArgumentParser(
        description="CADD Vault Integration Test Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s check                    # Check environment setup
  %(prog)s install                  # Install dependencies
  %(prog)s test                     # Run all tests
  %(prog)s test --type quick        # Run quick tests only
  %(prog)s test --verbose --html    # Run with detailed output and HTML report
        """)
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Check command
    check_parser = subparsers.add_parser("check", help="Check environment setup")
    check_parser.set_defaults(func=lambda args: check_environment())
    
    # Install command
    install_parser = subparsers.add_parser("install", help="Install dependencies")
    install_parser.set_defaults(func=lambda args: install_dependencies())
    
    # Test command
    test_parser = subparsers.add_parser("test", help="Run integration tests")
    test_parser.add_argument("--type", choices=["all", "quick", "api"], default="all",
                            help="Type of tests to run")
    test_parser.add_argument("--verbose", action="store_true",
                            help="Verbose output")
    test_parser.add_argument("--html", action="store_true",
                            help="Generate HTML report")
    test_parser.set_defaults(func=lambda args: run_tests(args.type, args.verbose, args.html))
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    success = args.func(args)
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())