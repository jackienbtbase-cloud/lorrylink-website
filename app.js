// ==========================================
// 1. SUPABASE CONFIGURATION
// ==========================================
// REPLACE THESE TWO LINES WITH YOUR ACTUAL SUPABASE URL AND ANON KEY
const SUPABASE_URL = 'https://cqbuguapyeyshujhkvky.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxYnVndWFweWV5c2h1amhrdmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2OTI5NTQsImV4cCI6MjEwMDI2ODk1NH0.C2EuPMe1ijXCcgJ300iGs-yjyVOs4lC-TuwGu33WAsc'; 

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Define the NBT Admin Email (Change this to the email you created in Step 1)
const NBT_ADMIN_EMAIL = 'pyh@nbt.com';

// ==========================================
// 2. UI ELEMENTS MAPPING
// ==========================================
const views = {
    login: document.getElementById('view-login'),
    register: document.getElementById('view-register'),
    forgotPassword: document.getElementById('view-forgot-password'),
    nbtHome: document.getElementById('view-nbt-home'),
    nbtPostJob: document.getElementById('view-nbt-post-job'),
    transporterHome: document.getElementById('view-transporter-home'),
    transporterMyJobs: document.getElementById('view-transporter-my-jobs'),
	counterOffer: document.getElementById('view-counter-offer'),
	nbtReviewBids: document.getElementById('view-nbt-review-bids'),
};

const navs = {
    container: document.getElementById('bottom-nav'),
    nbt: document.getElementById('nav-nbt'),
    transporter: document.getElementById('nav-transporter')
};

const btnLogout = document.getElementById('logout-btn');
const nbtJobsContainer = document.getElementById('nbt-jobs-container');
const transporterJobsContainer = document.getElementById('transporter-jobs-container');

// ==========================================
// 3. APP LOGIC & AUTHENTICATION
// ==========================================
const app = {
    currentUser: null,
    currentUserRole: null,
	transporterProfile: null,
    banTimer: null,

    async init() {
        // Setup Form Listeners
        document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('register-form').addEventListener('submit', (e) => this.handleRegister(e));
        document.getElementById('post-job-form').addEventListener('submit', (e) => this.submitNewJob(e));
		document.getElementById('forgot-password-form').addEventListener('submit', (e) => this.handleForgotPassword(e));
		document.getElementById('counter-offer-form').addEventListener('submit', (e) => this.submitCounterOffer(e));
        btnLogout.addEventListener('click', () => this.handleLogout());

        // Check if user is already logged in (Session persistence)
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            this.routeUser(session.user);
        } else {
            this.showView('login');
        }
    },

    // --- AUTHENTICATION FUNCTIONS ---

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        // Supabase Login
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            alert("Login Failed: " + error.message);
        } else {
            this.routeUser(data.user);
        }
    },

    async handleRegister(e) {
        e.preventDefault();
        const company = document.getElementById('reg-company').value;
        const contact = document.getElementById('reg-contact').value;
        const phone = document.getElementById('reg-phone').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        // 1. Create Auth User AND pass custom metadata to the backend
        const { data, error } = await supabaseClient.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    company_name: company,
                    contact_person: contact,
                    phone: phone
                }
            }
        });

        if (error) {
            alert("Registration Failed: " + error.message);
            return;
        }

        // 2. Success Alert (No need for manual profile insert here)
        alert("Registration successful! Please check your mailbox to confirm your email (make sure to check your spam folder too!).");
        document.getElementById('register-form').reset();
        this.showView('login');
    },

    async handleLogout() {
		if (this.banTimer) clearInterval(this.banTimer);
        await supabaseClient.auth.signOut();
        this.currentUser = null;
        this.currentUserRole = null;
        
        // Hide navs and button
        btnLogout.classList.add('hidden');
        navs.container.classList.add('hidden');
        navs.nbt.classList.replace('flex', 'hidden');
        navs.transporter.classList.replace('flex', 'hidden');
        
        document.getElementById('login-form').reset();
        this.showView('login');
    },
	
	async handleForgotPassword(e) {
        e.preventDefault();
        const email = document.getElementById('forgot-email').value;

        // Ask Supabase to send a password reset email
        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            // <-- UPDATE THIS LINE -->
            redirectTo: `${window.location.origin}/update-password.html` 
        });

        if (error) {
            alert("Error: " + error.message);
        } else {
            alert("Password reset link sent! Please check your email.");
            document.getElementById('forgot-password-form').reset();
            this.showView('login');
        }
    },

    // --- ROUTING & ROLE MANAGEMENT ---

    async routeUser(user) {
        this.currentUser = user;
        btnLogout.classList.remove('hidden');
        navs.container.classList.remove('hidden');

        // Check if NBT Admin
        if (user.email === NBT_ADMIN_EMAIL) {
            this.currentUserRole = 'nbt';
            this.showView('nbtHome');
            navs.nbt.classList.replace('hidden', 'flex');
            navs.transporter.classList.replace('flex', 'hidden');
            this.fetchJobsForNBT();
        } else {
            // Otherwise, it's a Transporter
            this.currentUserRole = 'transporter';
            
            // FETCH PROFILE BAN STATUS
            const { data: profile } = await supabaseClient
                .from('transporters')
                .select('status, banned_until')
                .eq('id', user.id)
                .single();
            this.transporterProfile = profile || {};

            navs.transporter.classList.replace('hidden', 'flex');
            navs.nbt.classList.replace('flex', 'hidden');
            this.showTransporterBoard(); 
        }
    },
	
	showTransporterBoard() {
        this.showView('transporterHome');
        this.fetchJobsForTransporter();
		this.fetchRecentMarketActivity();
		this.updateActivityStatus();
    },

    showMyJobs() {
        this.showView('transporterMyJobs');
        this.fetchMyJobs();
    },
	
	isBanned() {
        if (!this.transporterProfile || !this.transporterProfile.banned_until) return false;
        const banEnd = new Date(this.transporterProfile.banned_until).getTime();
        return banEnd > new Date().getTime();
    },

    startBanCountdown() {
        if (this.banTimer) clearInterval(this.banTimer);
        const banEnd = new Date(this.transporterProfile.banned_until).getTime();
        
        this.banTimer = setInterval(() => {
            const now = new Date().getTime();
            const distance = banEnd - now;
            const el = document.getElementById('ban-countdown');
            
            if (!el) return;

            if (distance < 0) {
                clearInterval(this.banTimer);
                el.innerHTML = "Ban has expired! Please refresh the page.";
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            el.innerHTML = `Ban expires in: <b>${days}d ${hours}h ${minutes}m ${seconds}s</b>`;
        }, 1000);
    },
	
	async updateActivityStatus() {
        if (!this.currentUser) return;
        
        await supabaseClient
            .from('transporters')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', this.currentUser.id);
    },
    // --- UTILS & DB FUNCTIONS ---

    showView(viewName) {
        Object.values(views).forEach(view => {
            if(view) view.classList.add('hidden');
        });
        if(views[viewName]) {
            views[viewName].classList.remove('hidden');
            views[viewName].classList.add('flex');
        }
    },

    async fetchJobsForNBT() {
        nbtJobsContainer.innerHTML = '<p class="text-gray-500">Loading jobs...</p>';
        
        // Fetch jobs, but exclude any that have an 'archived' status
        const { data: jobs, error } = await supabaseClient
            .from('jobs')
            .select('*')
            .neq('status', 'archived') // <-- ADD THIS LINE
            .order('created_at', { ascending: false });
            
        if (error) return console.error(error);
        this.renderNBTJobs(jobs);
    },

    async fetchJobsForTransporter() {
        transporterJobsContainer.innerHTML = '<p class="text-gray-500">Loading jobs...</p>';
        const { data: jobs, error } = await supabaseClient.from('jobs').select('*').eq('status', 'open').order('created_at', { ascending: false });
        if (error) return console.error(error);
        this.renderTransporterJobs(jobs);
    },

    // --- NEW: File Upload Helper ---
    async uploadJobPhoto(fileInputId) {
        const fileInput = document.getElementById(fileInputId);
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) return null;

        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('job-photos')
            .upload(filePath, file);

        if (error) {
            console.error('Upload error:', error);
            alert('Failed to upload photo: ' + error.message);
            return null;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from('job-photos')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    },

    // --- UPDATED: Submit Job with Photos ---
    async submitNewJob(e) {
        e.preventDefault();
        
        // Show loading state (uploading images takes a moment)
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Uploading & Publishing...';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75');

        // Upload photos first
        const photo1Url = await this.uploadJobPhoto('job-photo-1');
        const photo2Url = await this.uploadJobPhoto('job-photo-2');

        const newJob = {
            po_number: document.getElementById('job-po-number').value, 
            source_loc: document.getElementById('job-source').value,
            source_maps_link: document.getElementById('job-source-link').value,
			dest_loc: document.getElementById('job-dest').value,
            dest_maps_link: document.getElementById('job-dest-link').value,
            item_desc: document.getElementById('job-item').value,
            quantity: parseInt(document.getElementById('job-qty').value),
            delivery_date: document.getElementById('job-date').value,
            offered_price: parseFloat(document.getElementById('job-price').value),
            remarks: document.getElementById('job-remarks').value,
            photo_1_url: photo1Url, // <-- NEW
            photo_2_url: photo2Url  // <-- NEW
        };

        const { error } = await supabaseClient.from('jobs').insert([newJob]);
        
        // Restore button state
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75');

        if (error) {
            alert("Failed to post job: " + error.message);
        } else {
            alert("Job Posted Successfully!");
            document.getElementById('post-job-form').reset();
            this.showView('nbtHome');
            this.fetchJobsForNBT();
        }
    },
	
	async quickAccept(jobId, offeredPrice) {
		if (this.isBanned()) {
            alert("Your account is currently suspended. You cannot accept or bid on jobs.");
            return;
        }
        // --- 1. VALIDATION CHECK ---
        const { data: existingBids, error: fetchError } = await supabaseClient
            .from('bids')
            .select('proposed_price')
            .eq('job_id', jobId)
            .eq('transporter_id', this.currentUser.id);

        if (fetchError) {
            alert("Error validating bid: " + fetchError.message);
            return;
        }

        if (existingBids && existingBids.length > 0) {
            // Check if they already quick accepted (bid price equals original offer)
            const hasQuickAccepted = existingBids.some(bid => bid.proposed_price === offeredPrice);
            if (hasQuickAccepted) {
                alert("You have already accepted this job, please wait for approval");
                return;
            }
            
            // Check if they previously placed a counter-offer that was actually LOWER than the quick accept price
            const lowestPreviousBid = Math.min(...existingBids.map(b => b.proposed_price));
            if (offeredPrice >= lowestPreviousBid) {
                alert("Invalid bid = Counteroffer price cannot be higher than your previous bid");
                return;
            }
        }
        // --- END VALIDATION ---

        if (!confirm("Are you sure you want to accept this job for RM " + offeredPrice + "?")) return;

        const newBid = {
            job_id: jobId,
            transporter_id: this.currentUser.id,
            proposed_price: offeredPrice,
            status: 'submitted'
        };

        const { error } = await supabaseClient.from('bids').insert([newBid]);

        if (error) {
            alert("Error submitting bid: " + error.message);
        } else {
            alert("Job accepted successfully! Awaiting NBT approval.");
            this.fetchJobsForTransporter(); 
        }
    },
	
	async prepareCounterOffer(jobId, originalDate, originalPrice) {
		if (this.isBanned()) {
            alert("Your account is currently suspended. You cannot accept or bid on jobs.");
            return;
        }
        // --- 1. INSTANT VALIDATION CHECK ---
        const { data: existingBids, error: fetchError } = await supabaseClient
            .from('bids')
            .select('proposed_price')
            .eq('job_id', jobId)
            .eq('transporter_id', this.currentUser.id);

        if (fetchError) {
            alert("Error checking bid status: " + fetchError.message);
            return;
        }

        // If they already have bids, check if one of them was a quick accept
        if (existingBids && existingBids.length > 0) {
            const hasQuickAccepted = existingBids.some(bid => bid.proposed_price === originalPrice);
            if (hasQuickAccepted) {
                alert("You have already accepted this job, please wait for approval");
                return; // Stops the function here so the form never opens
            }
        }
        // --- END VALIDATION ---

        // Save these in the background so submitCounterOffer can validate the rules later
        this.currentCounterJobId = jobId;
        this.currentCounterOriginalPrice = originalPrice; 

        document.getElementById('counter-job-id').value = jobId;
        document.getElementById('counter-price').value = originalPrice; // Default to original price
        
        const dateInput = document.getElementById('counter-date');
        dateInput.value = originalDate; // Default to original date

        // Calculate +/- 3 days for the min/max limits
        const baseDate = new Date(originalDate);
        
        const minDate = new Date(baseDate);
        minDate.setDate(baseDate.getDate() - 3);
        
        const maxDate = new Date(baseDate);
        maxDate.setDate(baseDate.getDate() + 3);

        // Apply HTML min/max constraints (formatted as YYYY-MM-DD)
        dateInput.min = minDate.toISOString().split('T')[0];
        dateInput.max = maxDate.toISOString().split('T')[0];
        
        this.showView('counterOffer');
    },
	
    async submitCounterOffer(e) {
        e.preventDefault();
        const newPrice = parseFloat(document.getElementById('counter-price').value);
        const newDate = document.getElementById('counter-date').value;

        // --- 1. VALIDATION CHECK ---
        const { data: existingBids, error: fetchError } = await supabaseClient
            .from('bids')
            .select('proposed_price')
            .eq('job_id', this.currentCounterJobId)
            .eq('transporter_id', this.currentUser.id);

        if (fetchError) {
            alert("Error validating bid: " + fetchError.message);
            return;
        }

        if (existingBids && existingBids.length > 0) {
            // Check if they already quick accepted previously
            const hasQuickAccepted = existingBids.some(bid => bid.proposed_price === this.currentCounterOriginalPrice);
            if (hasQuickAccepted) {
                alert("You have already accepted this job, please wait for approval");
                return;
            }

            // Check if the new price is equal to or higher than their lowest previous bid
            const lowestPreviousBid = Math.min(...existingBids.map(b => b.proposed_price));
            if (newPrice >= lowestPreviousBid) {
                alert("Invalid bid = Counteroffer price cannot be higher than your previous bid");
                return;
            }
        }
        // --- END VALIDATION ---

        const newBid = {
            job_id: this.currentCounterJobId,
            transporter_id: this.currentUser.id,
            proposed_price: newPrice,
            proposed_date: newDate,
            status: 'submitted'
        };

        const { error } = await supabaseClient.from('bids').insert([newBid]);

        if (error) {
            alert("Error submitting counter-offer: " + error.message);
        } else {
            alert("Counter-offer submitted successfully!");
            document.getElementById('counter-offer-form').reset();
            this.showTransporterBoard(); 
        }
    },
	
	async viewBids(jobId) {
        this.showView('nbtReviewBids');
        const container = document.getElementById('bids-container');
        container.innerHTML = '<p class="text-sm text-gray-500">Loading bids...</p>';

        // 1. Fetch the original job to get the NBT offered price, date, locations, items, AND po_number
        const { data: job, error: jobError } = await supabaseClient
            .from('jobs')
            .select('offered_price, delivery_date, source_loc, dest_loc, quantity, item_desc, po_number, photo_1_url, photo_2_url')
            .eq('id', jobId)
            .single();

        if (jobError) {
            container.innerHTML = `<p class="text-red-500 text-sm">Error loading job details: ${jobError.message}</p>`;
            return;
        }

        // 2. Fetch bids for this specific job
        const { data: bids, error } = await supabaseClient
            .from('bids')
            .select('*')
            .eq('job_id', jobId)
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = `<p class="text-red-500 text-sm">Error: ${error.message}</p>`;
            return;
        }

        if (bids.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No bids have been submitted for this job yet.</p>';
            return;
        }
		
		// Sort the array to ensure the accepted bid is always at the top
        bids.sort((a, b) => {
            if (a.status === 'accepted' && b.status !== 'accepted') return -1;
            if (b.status === 'accepted' && a.status !== 'accepted') return 1;
            return 0; // Maintain existing date order for all other bids
        });
		
        // 3. Extract the transporter IDs from the bids to fetch their profiles
        const transporterIds = bids.map(bid => bid.transporter_id);
        
        const { data: transporters, error: transError } = await supabaseClient
            .from('transporters')
            .select('id, company_name, contact_person, phone')
            .in('id', transporterIds);

        // Create a lookup dictionary for easy matching
        const transporterProfiles = {};
        if (transporters) {
            transporters.forEach(t => {
                transporterProfiles[t.id] = t;
            });
        }

        const originalPrice = job.offered_price;
        const originalDate = job.delivery_date; 
        const sourceLoc = job.source_loc;
        const destLoc = job.dest_loc;
        const quantity = job.quantity;
        const itemDesc = job.item_desc;
        const poNumber = job.po_number || 'N/A'; // <-- NEW

        // 4. Render the bids with the price comparison
        // Add a banner at the top showing the original route, budget, date, items, AND PO Number
        let html = `
            <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 flex flex-col gap-2 shadow-sm">
                <!-- UPDATED: Flex container to put Route on left, PO badge on right -->
                <div class="flex justify-between items-start border-b border-blue-200 pb-2">
                    <div class="flex items-center gap-2 font-bold text-sm">
                        <span>${sourceLoc}</span> 
                        <i class="ri-arrow-right-line text-blue-400"></i> 
                        <span>${destLoc}</span>
                    </div>
                    <span class="text-[10px] font-bold bg-blue-200 text-blue-900 px-2 py-0.5 rounded shadow-sm">PO: ${poNumber}</span>
                </div>
                
                <div class="flex justify-between font-bold text-sm mt-1">
                    <span>Original Budget:</span>
                    <span>RM ${originalPrice}</span>
                </div>
                <div class="flex justify-between text-xs font-semibold opacity-80">
                    <span>Original Date:</span>
                    <span><i class="ri-calendar-line"></i> ${originalDate}</span>
                </div>
                <div class="flex justify-between text-xs font-semibold opacity-80 mt-0.5">
                    <span>Items:</span>
                    <span><i class="ri-box-3-line"></i> ${quantity} ${itemDesc}</span>
                </div>
				${(job.photo_1_url || job.photo_2_url) ? `
                    <div class="flex gap-2 mt-2 pt-2 border-t border-blue-200/50">
                        ${job.photo_1_url ? `<a href="${job.photo_1_url}" target="_blank" class="block h-12 w-12 overflow-hidden rounded border border-blue-200 shadow-sm hover:opacity-80"><img src="${job.photo_1_url}" class="h-full w-full object-cover"></a>` : ''}
                        ${job.photo_2_url ? `<a href="${job.photo_2_url}" target="_blank" class="block h-12 w-12 overflow-hidden rounded border border-blue-200 shadow-sm hover:opacity-80"><img src="${job.photo_2_url}" class="h-full w-full object-cover"></a>` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        html += bids.map(bid => {
            // Match the profile or provide a fallback if missing
            const profile = transporterProfiles[bid.transporter_id] || { 
                company_name: 'Unknown Transporter', 
                contact_person: 'N/A', 
                phone: 'N/A' 
            };

            // Format the bid submission date and time
            let submittedAt = 'Unknown time';
            if (bid.created_at) {
                const dateObj = new Date(bid.created_at);
                submittedAt = dateObj.toLocaleString('en-MY', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                });
            }

            // Calculate difference and create a visual badge
            const difference = bid.proposed_price - originalPrice;
            let diffBadge = '';
            
            if (difference === 0) {
                diffBadge = `<span class="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Match</span>`;
            } else if (difference < 0) {
                diffBadge = `<span class="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded">▼ RM ${Math.abs(difference)} (Savings)</span>`;
            } else {
                diffBadge = `<span class="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded">▲ RM ${difference} (Higher)</span>`;
            }

            // Check if the transporter proposed a different date
            let dateAlert = '';
            if (bid.proposed_date && bid.proposed_date !== job.delivery_date) {
                dateAlert = `
                    <div class="mt-3 bg-orange-50 border border-orange-200 text-orange-800 text-xs p-2 rounded flex items-center gap-2">
                        <i class="ri-calendar-schedule-line text-lg"></i>
                        <span><b>New Date Proposed:</b> ${bid.proposed_date}</span>
                    </div>
                `;
            }

            return `
                <div class="bg-white p-4 rounded-lg shadow border border-gray-200 flex flex-col gap-3">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-gray-800 text-lg">${profile.company_name}</h3>
                            <p class="text-xs text-gray-600 mt-1">
                                <i class="ri-user-line text-gray-400"></i> ${profile.contact_person}
                            </p>
                            <p class="text-xs text-gray-600 mt-1">
                                <i class="ri-phone-line text-gray-400"></i> ${profile.phone}
                            </p>
                        </div>
                        <div class="text-right flex flex-col items-end">
                            <p class="text-xs text-gray-500 font-semibold mb-1">Proposed Price</p>
                            <p class="text-xl font-bold text-blue-700 mb-1">RM ${bid.proposed_price}</p>
                            ${diffBadge}
                        </div>
                    </div>
                    ${dateAlert} 
                    <div class="mt-2 flex justify-between items-center border-t border-gray-100 pt-3">
                        <span class="text-[10px] text-gray-400 font-medium"><i class="ri-time-line"></i> ${submittedAt}</span>
                        ${bid.status === 'submitted' ? 
                            `<button onclick="app.awardJob('${bid.id}', '${jobId}', ${bid.proposed_price})" class="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded shadow hover:bg-green-700">Award Job</button>` 
                            : 
                            `<span class="text-xs font-bold uppercase px-3 py-1 bg-green-100 text-green-700 rounded">${bid.status}</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    },

    async awardJob(bidId, jobId, acceptedPrice) {
        if (!confirm("Are you sure you want to award the job to this transporter?")) return;

        // 1. Update the winning bid status to 'accepted'
        const { error: bidError } = await supabaseClient
            .from('bids')
            .update({ status: 'accepted' })
            .eq('id', bidId);

        if (bidError) {
            alert("Error awarding job: " + bidError.message);
            return;
        }

        // 2. Update the job status to 'assigned' AND save the accepted price
        const { error: jobError } = await supabaseClient
            .from('jobs')
            .update({ 
                status: 'assigned',
                accepted_price: acceptedPrice // <-- NEW: Saves the final agreed price
            })
            .eq('id', jobId);

        if (jobError) {
            alert("Error updating job status: " + jobError.message);
            return;
        }

        alert("Job awarded successfully!");
        this.showView('nbtHome');
        this.fetchJobsForNBT(); // Refresh NBT dashboard
    },
	
	async deleteJob(jobId) {
        if (!confirm("Are you sure you want to remove this job from your view? (It will be safely kept in the database).")) return;

        // Soft delete: Update the status to 'archived' instead of deleting the row
        const { error } = await supabaseClient
            .from('jobs')
            .update({ status: 'archived' })
            .eq('id', jobId);

        if (error) {
            alert("Error removing job: " + error.message);
        } else {
            alert("Job successfully removed from view.");
            this.fetchJobsForNBT(); // Refresh the dashboard
        }
    },

    async unassignJob(jobId) {
        if (!confirm("Are you sure you want to undo this assignment? The job will be returned to the open market.")) return;

        // 1. Revert job status back to 'open' and clear the accepted price
        const { error: jobError } = await supabaseClient
            .from('jobs')
            .update({ 
                status: 'open',
                accepted_price: null // <-- NEW: Clears the price so it's fresh for new bids
            })
            .eq('id', jobId);

        if (jobError) {
            alert("Error unassigning job: " + jobError.message);
            return;
        }

        // 2. Revert the accepted bid back to 'submitted' so the transporter isn't permanently locked in
        await supabaseClient
            .from('bids')
            .update({ status: 'submitted' })
            .eq('job_id', jobId)
            .eq('status', 'accepted');

        alert("Job assignment undone. It is now open for bids again.");
        this.fetchJobsForNBT(); // Refresh the dashboard
    },

    // --- RENDER HTML FUNCTIONS ---
	async fetchMyJobs() {
        const container = document.getElementById('my-jobs-container');
        container.innerHTML = '<p class="text-gray-500 text-sm">Loading your assigned jobs...</p>';

        // Fetch accepted bids for this transporter, and expand the related job details in one query!
        const { data: bids, error } = await supabaseClient
            .from('bids')
            .select('*, jobs(*)')
            .eq('transporter_id', this.currentUser.id)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            container.innerHTML = `<p class="text-red-500 text-sm">Error loading jobs: ${error.message}</p>`;
            return;
        }

        this.renderMyJobs(bids);
    },

    renderMyJobs(bids) {
        const container = document.getElementById('my-jobs-container');
        if (bids.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">You have no assigned jobs yet.</p>';
            return;
        }

        container.innerHTML = bids.map(bid => {
            const job = bid.jobs;
            if (!job) return ''; // Safety fallback

            // Check if the transporter proposed a new date, otherwise use the original
            const finalDate = bid.proposed_date || job.delivery_date;

            return `
                <div class="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-gray-500">Agreed Delivery: ${finalDate}</span>
                        <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded uppercase flex items-center gap-1"><i class="ri-truck-fill"></i> Assigned</span>
                    </div>
                    <div class="flex flex-col gap-1 text-sm mb-3">
                        <p class="font-bold text-gray-800 text-base">${job.source_loc} <i class="ri-arrow-right-line text-blue-400"></i> ${job.dest_loc}</p>
                    </div>
					${(job.photo_1_url || job.photo_2_url) ? `
                    <div class="flex gap-2 mb-3">
                        ${job.photo_1_url ? `<a href="${job.photo_1_url}" target="_blank" class="block h-16 w-16 overflow-hidden rounded border border-gray-200 shadow-sm hover:opacity-80"><img src="${job.photo_1_url}" class="h-full w-full object-cover"></a>` : ''}
                        ${job.photo_2_url ? `<a href="${job.photo_2_url}" target="_blank" class="block h-16 w-16 overflow-hidden rounded border border-gray-200 shadow-sm hover:opacity-80"><img src="${job.photo_2_url}" class="h-full w-full object-cover"></a>` : ''}
                    </div>
                ` : ''}
                    <p class="text-xs text-gray-500 mb-2 bg-gray-50 p-2 rounded border border-gray-100">Remarks: ${job.remarks || 'None'}</p>
                    <hr class="mb-3 border-gray-100">
                    <div class="flex justify-between items-center">
                        <span class="text-sm font-semibold text-gray-600"><i class="ri-box-3-line"></i> ${job.quantity} ${job.item_desc}</span>
                        <div class="text-right flex flex-col items-end">
                            <span class="text-[10px] text-gray-400 font-bold uppercase mb-0.5">Your Price</span>
                            <span class="font-bold text-xl text-blue-700 leading-none">RM ${bid.proposed_price}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },
	
    renderNBTJobs(jobs) {
        const container = document.getElementById('nbt-jobs-container');
        if (jobs.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No jobs posted yet.</p>';
            return;
        }

        container.innerHTML = jobs.map(job => {
            const isAssigned = job.status === 'assigned';
            const statusColor = isAssigned ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';

            return `
                <div class="bg-white p-4 rounded-lg shadow border border-gray-200">
                    <div class="flex justify-between items-start mb-2">
                        <div>
                            <h3 class="font-bold text-gray-800">${job.source_loc} <i class="ri-arrow-right-line text-blue-500"></i> ${job.dest_loc}</h3>
                            <!-- NEW: Added PO Number -->
                            <p class="text-xs font-bold text-blue-700 mt-1"><i class="ri-file-list-3-line"></i> PO: ${job.po_number || 'N/A'}</p>
                            
                            <p class="text-xs text-gray-500 mt-1"><i class="ri-calendar-line text-gray-400"></i> Date: ${job.delivery_date}</p>
                            <p class="text-xs text-gray-500 mt-0.5"><i class="ri-box-3-line text-gray-400"></i> Items: ${job.quantity} ${job.item_desc}</p>
                        </div>
                        <span class="${statusColor} text-[10px] font-bold px-2 py-1 rounded uppercase">${job.status || 'open'}</span>
                    </div>
                    
                    <div class="mt-3 flex justify-between items-center border-t border-gray-100 pt-3">
                        <p class="text-sm font-bold text-gray-700">Budget: RM ${job.offered_price}</p>
                        
                        <div class="flex gap-2">
                            ${isAssigned 
                                ? `<button onclick="app.viewBids('${job.id}')" class="bg-blue-600 text-white text-[11px] font-bold px-2 py-1.5 rounded shadow hover:bg-blue-700">Assigned Details</button>
                                   <button onclick="app.unassignJob('${job.id}')" class="bg-orange-500 text-white text-[11px] font-bold px-2 py-1.5 rounded shadow hover:bg-orange-600">Undo</button>`
                                : `<button onclick="app.viewBids('${job.id}')" class="bg-blue-600 text-white text-[11px] font-bold px-3 py-1.5 rounded shadow hover:bg-blue-700">View Bids</button>`
                            }
                            <button onclick="app.deleteJob('${job.id}')" class="bg-red-50 text-red-600 text-sm font-bold px-3 py-1.5 rounded shadow hover:bg-red-100 transition-colors">
                                <i class="ri-delete-bin-line"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderTransporterJobs(jobs) {
        const banned = this.isBanned();
        let bannerHtml = '';

        if (banned) {
            bannerHtml = `
                <div class="mb-5 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg shadow-sm">
                    <div class="flex items-center gap-2 font-bold mb-1 text-red-700">
                        <i class="ri-error-warning-fill text-xl"></i> Account Suspended
                    </div>
                    <p class="text-xs mb-2">You have been temporarily banned from accepting or bidding on new jobs. You can still view the market board.</p>
                    <p class="text-sm font-bold text-red-900 bg-red-100 p-2 rounded inline-block" id="ban-countdown">Calculating remaining time...</p>
                </div>
            `;
            this.startBanCountdown();
        }

        if (jobs.length === 0) {
            transporterJobsContainer.innerHTML = bannerHtml + '<p class="text-gray-500">No open jobs available.</p>';
            return;
        }

        const jobsHtml = jobs.map(job => `
            <div class="bg-white p-4 rounded-lg shadow border-l-4 ${banned ? 'border-gray-400 opacity-75' : 'border-green-500'}">
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs font-bold text-gray-500">Delivery: ${job.delivery_date}</span>
                    <span class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Open</span>
                </div>
                <div class="flex flex-col gap-1 text-sm mb-3">
                    <p class="font-semibold flex items-center gap-1">
                        <i class="ri-map-pin-line text-gray-400"></i> ${job.source_loc}
                        ${job.source_maps_link ? `<a href="${job.source_maps_link}" target="_blank" class="text-blue-500 hover:text-blue-700 ml-2" title="View on Maps"><i class="ri-map-pin-user-fill text-lg"></i></a>` : ''}
                    </p>
                    <p class="font-semibold flex items-center gap-1">
                        <i class="ri-map-pin-time-line text-gray-400"></i> ${job.dest_loc}
                        ${job.dest_maps_link ? `<a href="${job.dest_maps_link}" target="_blank" class="text-blue-500 hover:text-blue-700 ml-2" title="View on Maps"><i class="ri-map-pin-user-fill text-lg"></i></a>` : ''}
                    </p>
                </div>
				${(job.photo_1_url || job.photo_2_url) ? `
                    <div class="flex gap-2 mb-3">
                        ${job.photo_1_url ? `<a href="${job.photo_1_url}" target="_blank" class="block h-16 w-16 overflow-hidden rounded border border-gray-200 shadow-sm hover:opacity-80"><img src="${job.photo_1_url}" class="h-full w-full object-cover"></a>` : ''}
                        ${job.photo_2_url ? `<a href="${job.photo_2_url}" target="_blank" class="block h-16 w-16 overflow-hidden rounded border border-gray-200 shadow-sm hover:opacity-80"><img src="${job.photo_2_url}" class="h-full w-full object-cover"></a>` : ''}
                    </div>
                ` : ''}
                <p class="text-xs text-gray-500 mb-2">Remarks: ${job.remarks || 'None'}</p>
                <hr class="mb-3 border-gray-100">
                <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-600"><i class="ri-box-3-line"></i> ${job.quantity} ${job.item_desc}</span>
                    <span class="font-bold text-lg text-gray-800">RM ${job.offered_price}</span>
                </div>
                <div class="flex gap-2 mt-3">
                    ${banned 
                        ? `<button disabled class="flex-1 bg-gray-200 text-gray-500 font-semibold py-2 rounded cursor-not-allowed flex justify-center items-center gap-2"><i class="ri-lock-line"></i> Banned</button>`
                        : `<button onclick="app.quickAccept('${job.id}',${job.offered_price})" class="flex-1 bg-green-600 text-white font-semibold py-2 rounded shadow hover:bg-green-700">Quick Accept</button>
                           <button onclick="app.prepareCounterOffer('${job.id}', '${job.delivery_date}',${job.offered_price})" class="flex-1 bg-gray-200 text-gray-700 font-semibold py-2 rounded shadow hover:bg-gray-300">Counter-Offer</button>`
                    }
                </div>
            </div>
        `).join('');

        transporterJobsContainer.innerHTML = bannerHtml + jobsHtml;
    },
	
	async fetchRecentMarketActivity() {
        const container = document.getElementById('recent-activity-container');
        if (!container) return;
        
        container.innerHTML = '<p class="text-gray-400 text-xs">Loading recent history...</p>';
        
        // Fetch the last 5 awarded jobs for price anchoring
        const { data: jobs, error } = await supabaseClient
            .from('jobs')
            .select('*')
            .eq('status', 'assigned')
            .order('created_at', { ascending: false }) // <-- CHANGED from updated_at to created_at
            .limit(5);
            
        if (error) {
            console.error("Error fetching market activity:", error);
            container.innerHTML = '';
            return;
        }
        
        this.renderRecentMarketActivity(jobs);
    },

    renderRecentMarketActivity(jobs) {
        const container = document.getElementById('recent-activity-container');
        if (jobs.length === 0) {
            container.innerHTML = '<p class="text-gray-400 text-xs italic">No recent market activity yet.</p>';
            return;
        }
        
        container.innerHTML = jobs.map(job => {
            // Format the job posted date
            let postedDate = 'Unknown date';
            if (job.created_at) {
                const dateObj = new Date(job.created_at);
                postedDate = dateObj.toLocaleDateString('en-MY', { 
                    day: '2-digit', 
                    month: 'short', 
                    year: 'numeric' 
                });
            }

            return `
                <div class="bg-gray-50 p-3 rounded-lg border border-gray-200 opacity-60 grayscale transition-all duration-300 hover:grayscale-0 hover:opacity-100">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1">
                            <i class="ri-lock-line"></i> Job Awarded
                        </span>
                        <!-- NEW: Added Posted Date here -->
                        <span class="text-[10px] text-gray-400 font-medium">Posted: ${postedDate}</span>
                    </div>
                    
                    <div class="flex justify-between items-center mt-2">
                        <div class="text-xs text-gray-500 font-medium">
                            <p class="text-gray-700">${job.source_loc} <i class="ri-arrow-right-line text-gray-400"></i> ${job.dest_loc}</p>
                            <p class="mt-0.5"><i class="ri-box-3-line"></i> ${job.quantity} ${job.item_desc}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] text-gray-400 uppercase font-bold mb-0.5">Closed At</p>
                            <!-- Uses accepted_price if available, falls back to original budget -->
                            <p class="font-bold text-gray-600">RM ${job.accepted_price || job.offered_price}</p>
                        </div>
                    </div>
                    
                    <div class="mt-3 bg-gray-200 text-gray-500 text-[10px] p-1.5 rounded text-center font-semibold italic">
                        Claimed! Check the board daily to secure the next load.
                    </div>
                </div>
            `;
        }).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});