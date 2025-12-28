import smtplib

# Your properties
smtp_host = 'smtp-relay.gmail.com'
smtp_port = 587
username = 'support@smartgeocode.io'
password = 'lmvuldvtvdezysjj'  # App password

try:
    server = smtplib.SMTP(smtp_host, smtp_port)
    server.starttls()
    server.login(username, password)
    server.sendmail(username, 'test@example.com', f'Subject: SMTP Test\n\nTest email from smartgeocode.')
    server.quit()
    print("SMTP success – email sent!")
except Exception as e:
    print(f"SMTP fail: {e}")