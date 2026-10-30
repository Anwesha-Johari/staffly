
from employee_backend import hash_password, verify_password

# Use a temporary test password, not a real account password.
test_password = "DemoPassword!482"

# Generate a hash
password_hash = hash_password(test_password)

print("TEST 1: Hash is generated")
print("Passed:", password_hash.startswith("$2"))

print("\nTEST 2: Correct password is accepted")
print("Passed:", verify_password(test_password, password_hash))

print("\nTEST 3: Incorrect password is rejected")
print("Passed:", not verify_password("WrongPassword!482", password_hash))

print("\nTEST 4: Same password generates a different salted hash")
second_hash = hash_password(test_password)
print("Passed:", password_hash != second_hash)

print("\nTEST 5: Empty password is rejected")
try:
    hash_password("")
    print("Passed: False")
except ValueError:
    print("Passed: True")
