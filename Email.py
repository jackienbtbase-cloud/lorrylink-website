import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from supabase import create_client, Client

# ==========================================
# 1. CONFIGURATION
# ==========================================
SUPABASE_URL = 'https://cqbuguapyeyshujhkvky.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYnVndWFweWV5c2h1amhrdmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTI5NTQsImV4cCI6MjEwMDI2ODk1NH0.C2EuPMe1ijXCcgJ300iGs-yjyVOs4lC-TuwGu33WAsc'

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465
SENDER_EMAIL = "nbt.bnp@gmail.com"
SENDER_PASSWORD = "gsfw ervg ejts isaz"  # 16-character App Password

APP_URL = "https://nbt-lorrylink.netlify.app/"  # Link to your Netlify web app

# Initialize Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_transporter_emails():
    """Fetch all registered transporter emails from the database."""
    try:
        response = supabase.table("transporters").select("email").execute()
        emails = [row["email"] for row in response.data if row.get("email")]
        return emails
    except Exception as e:
        print(f"Error fetching emails from Supabase: {e}")
        return []


def get_latest_job():
    """Fetch the most recently posted job from the database."""
    try:
        # Sort by 'created_at' descending and fetch exactly 1 record
        response = (
            supabase.table("jobs")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Error fetching the latest job: {e}")
        return None


def send_new_job_notification(job_details):
    """Sends job offer email details to all registered transporters."""
    recipients = get_transporter_emails()

    if not recipients:
        print("No registered transporters found.")
        return

    subject = f"🚨 New Job Offer: {job_details['source_loc']} ➔ {job_details['dest_loc']}"

    # Professional HTML Email Body
    html_body = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f5; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            
            <div style="background-color: #1e40af; color: #ffffff; padding: 20px; text-align: center;">
                <h1 style="margin: 0; font-size: 22px;">NBT LorryLink</h1>
                <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">New Freight Offer Available</p>
            </div>
            
            <div style="padding: 24px;">
                <p>Hello Transporter,</p>
                <p>A new job has just been posted on <strong>NBT LorryLink</strong>. Below are the offer details:</p>
                
                <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 6px 0;"><strong>📍 Route:</strong> {job_details['source_loc']} ➔ {job_details['dest_loc']}</p>
                    <p style="margin: 6px 0;"><strong>📦 Item:</strong> {job_details['quantity']} {job_details['item_desc']}</p>
                    <p style="margin: 6px 0;"><strong>📅 Delivery Date:</strong> {job_details['delivery_date']}</p>
                    <p style="margin: 6px 0;"><strong>💰 Offer Price:</strong> <span style="color: #15803d; font-weight: bold;">RM {job_details['offered_price']}</span></p>
                    <p style="margin: 6px 0;"><strong>📝 Remarks:</strong> {job_details.get('remarks') or 'None'}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <a href="{APP_URL}" style="background-color: #16a34a; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">Login to View & Bid</a>
                </div>

                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 20px 0;" />
                <p style="font-size: 12px; color: #71717a; text-align: center; margin: 0;">This is an automated operational alert from NBT Base & Pave Sdn. Bhd.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Send via Gmail SMTP_SSL (Port 465)
    try:
        print("Connecting to Gmail SMTP server...")
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SENDER_EMAIL, SENDER_PASSWORD)
            for recipient in recipients:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"NBT LorryLink <{SENDER_EMAIL}>"
                msg["To"] = recipient

                msg.attach(MIMEText(html_body, "html"))
                server.sendmail(SENDER_EMAIL, recipient, msg.as_string())
                print(f"✓ Notification sent to: {recipient}")

        print("\nAll notification emails sent successfully!")

    except Exception as e:
        print(f"\n❌ SMTP Error: {e}")


# ==========================================
# 2. RUN SCRIPT
# ==========================================
if __name__ == "__main__":
    print("Checking database for the latest job...")
    latest_job = get_latest_job()

    if latest_job:
        print(f"Latest job found! Route: {latest_job['source_loc']} ➔ {latest_job['dest_loc']}")
        send_new_job_notification(latest_job)
    else:
        print("No jobs found in the database. Exiting.")