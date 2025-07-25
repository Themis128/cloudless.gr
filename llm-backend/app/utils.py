# Utility functions for file handling, job tracking, etc.

def save_uploaded_file(upload_file, dest_path):
    with open(dest_path, "wb") as f:
        f.write(upload_file.file.read())

<<<<<<< HEAD
# Add more utilities as needed 
=======
# Add more utilities as needed
>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a
