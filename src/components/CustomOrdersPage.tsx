import React, { useState, useEffect } from 'react';
import { SIGNATURE_BROWNIES } from '../data/brownies';
import { useContent } from '../context/ContentContext';
import { useAuth } from '../context/AuthContext';
import { buildWhatsAppUrl, triggerWhatsAppRedirect } from '../utils/formatters';
import {
  Sparkles,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Send,
  Phone,
  Mail,
  ChefHat,
  Gift,
  MessageCircle,
  X,
  Plus,
} from 'lucide-react';

interface CustomOrdersPageProps {
  onBackToHome: () => void;
  onNavigateToMenu?: () => void;
  onOpenClasses?: () => void;
}

export const CustomOrdersPage: React.FC<CustomOrdersPageProps> = ({
  onBackToHome,
  onNavigateToMenu,
}) => {
  const { menuItems, settings } = useContent();
  const { user, signInWithGoogle, submitInquiry } = useAuth();

  const availableMenu = menuItems && menuItems.length > 0 ? menuItems : SIGNATURE_BROWNIES;
  const whatsappNum = settings.whatsappNumber || '7339651529';

  // Custom Order Inquiry Form State
  const [eventType, setEventType] = useState('Wedding Favor & Dessert Table');
  const [batchSize, setBatchSize] = useState('½ KG');
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([
    availableMenu[0]?.name || 'Classic Brownie',
    availableMenu[1]?.name || 'Triple Chocolate',
  ]);
  const [customFlavorInput, setCustomFlavorInput] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pre-fill user profile info if signed in
  useEffect(() => {
    if (user) {
      if (user.displayName && !customerName) setCustomerName(user.displayName);
      if (user.email && !customerEmail) setCustomerEmail(user.email);
    }
  }, [user]);

  const toggleFlavor = (flavorName: string) => {
    setSelectedFlavors((prev) =>
      prev.includes(flavorName)
        ? prev.filter((f) => f !== flavorName)
        : [...prev, flavorName]
    );
  };

  const handleAddCustomFlavor = () => {
    const trimmed = customFlavorInput.trim();
    if (!trimmed) return;
    if (!selectedFlavors.includes(trimmed)) {
      setSelectedFlavors((prev) => [...prev, trimmed]);
    }
    setCustomFlavorInput('');
  };

  const clearAllFlavors = () => {
    setSelectedFlavors([]);
  };

  const whatsappMessageText = `Hello BrowineGirlCakes! I would like to place a Custom Order request:
• Name: ${customerName || 'Customer'}
• Phone: ${customerPhone || 'Not provided'}
• Email: ${customerEmail || 'Not provided'}
• Delivery Address: ${deliveryAddress || 'Not provided'}
• Event / Occasion: ${eventType}
• Batch Size / Weight: ${batchSize}
• Target Date: ${eventDate || 'Flexible / To be confirmed'}
• Selected Items: ${selectedFlavors.length > 0 ? selectedFlavors.join(', ') : 'Chef Choice Selection'}
• Special Notes: ${specialNotes || 'None'}`;

  const whatsappInquiryUrl = buildWhatsAppUrl(whatsappNum, whatsappMessageText);

  const handleWhatsAppOrderClick = async (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        setErrorMsg('Please sign in with Google before placing a custom order.');
        return;
      }
      triggerWhatsAppRedirect(whatsappInquiryUrl);
    }
  };

  const handleCustomOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let activeUser = user;
    if (!activeUser) {
      const signedInUser = await signInWithGoogle();
      if (!signedInUser) {
        setErrorMsg('Please sign in with Google before placing a custom order.');
        return;
      }
      activeUser = signedInUser;
    }

    const resolvedName = customerName.trim() || activeUser.displayName || '';
    const resolvedEmail = customerEmail.trim() || activeUser.email || '';

    if (!resolvedName) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!customerPhone.trim()) {
      setErrorMsg('Please enter your contact phone number.');
      return;
    }
    if (!resolvedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMsg('Please enter your complete delivery address. Delivery address is mandatory.');
      return;
    }

    try {
      setIsSubmitting(true);
      const subject = `Custom Order: ${eventType} (${batchSize})`;
      const messageBody = `
=== CUSTOM ORDER REQUEST ===
Contact Name: ${resolvedName}
Contact Email: ${resolvedEmail}
Contact Phone: ${customerPhone}
Delivery Address: ${deliveryAddress.trim()}
Event Type: ${eventType}
Target Date: ${eventDate || 'Flexible / To be confirmed'}
Estimated Batch Size: ${batchSize}
Selected Items: ${selectedFlavors.length > 0 ? selectedFlavors.join(', ') : 'Chef Choice Selection'}

Special Requests / Dietary Notes:
${specialNotes || 'None specified'}
      `.trim();

      await submitInquiry(subject, messageBody, {
        name: resolvedName,
        email: resolvedEmail,
        phone: customerPhone,
      });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to submit custom order request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F0E5] text-[#3B211B] flex flex-col">
      {/* Sub-Header Navigation Bar */}
      <div className="sticky top-16 sm:top-20 z-30 bg-[#1F0F0C]/95 text-[#F8F0E5] border-b border-[#3B211B] px-3 sm:px-8 py-2.5 sm:py-3.5 shadow-md backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToHome}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-xs font-semibold text-[#E8D6C3] transition-all cursor-pointer touch-manipulation"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] active:scale-95 text-white font-bold text-xs shadow-xs transition-all touch-manipulation"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">WhatsApp:</span>
              <span>{whatsappNum}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Compact Hero Header */}
      <section className="bg-[#23120E] text-[#F8F0E5] py-10 sm:py-14 px-4 sm:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#C47B55]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10 text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#3B211B] text-[#E5A962] border border-[#C47B55]/40 text-xs font-semibold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Custom Orders &amp; Event Catering
          </div>

          <h2 className="font-gallery text-2xl sm:text-4xl font-bold tracking-tight text-[#F8F0E5]">
            Request a Custom Brownie or Cake Order
          </h2>

          <p className="text-xs sm:text-sm text-[#E8D6C3]/80 max-w-2xl mx-auto leading-relaxed">
            We handcraft customized brownie spreads, assorted gift boxes, frosted brownies, and celebration bento cakes. Fill out the form below and your order inquiry will be sent directly to our bakery and WhatsApp hotline.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-2 text-xs text-[#E5A962]">
            <span className="flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-[#C47B55]" /> Custom Packaging Available
            </span>
            <span className="flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-[#C47B55]" /> Fresh 1/2 kg, 1 kg &amp; Bulk Batches
            </span>
          </div>
        </div>
      </section>

      {/* CUSTOM ORDER CONSULTATION FORM SECTION */}
      <section
        id="custom-order-form"
        className="py-10 sm:py-16 px-4 sm:px-8 bg-white border-t border-[#E8D6C3] flex-1"
      >
        <div className="max-w-4xl mx-auto">
          {/* Direct WhatsApp Callout Banner */}
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-md">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#1F0F0C]">Direct Bakery WhatsApp Hotline</p>
                <p className="text-[11px] text-[#3B211B]/80">
                  Have a quick question? You can chat directly with our baker on WhatsApp at <strong>+91 {whatsappNum}</strong> or submit the custom order form below.
                </p>
              </div>
            </div>
            <a
              href={whatsappInquiryUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleWhatsAppOrderClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-md transition-all shrink-0 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat on WhatsApp: {whatsappNum}</span>
            </a>
          </div>

          {submitted ? (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#F8F0E5] border-2 border-[#C47B55] text-center space-y-4 shadow-xl animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="font-gallery text-2xl font-bold text-[#3B211B]">
                Custom Order Inquiry Received!
              </h4>
              <p className="text-sm text-[#3B211B]/80 max-w-md mx-auto leading-relaxed">
                Thank you, <strong>{customerName}</strong>! Your custom order request for <strong>{eventType}</strong> has been received and saved by our bakery team.
              </p>

              <div className="p-4 bg-white rounded-2xl border border-[#E8D6C3] max-w-md mx-auto text-left text-xs space-y-1.5">
                <p><strong>Batch / Quantity:</strong> {batchSize}</p>
                <p><strong>Selected Items ({selectedFlavors.length}):</strong> {selectedFlavors.join(', ') || 'Chef Choice'}</p>
                <p><strong>Contact:</strong> {customerEmail} &bull; {customerPhone}</p>
              </div>

              <div className="pt-3 flex flex-wrap justify-center gap-3">
                <a
                  href={whatsappInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-6 py-3 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-md"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send Order on WhatsApp ({whatsappNum})</span>
                </a>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Submit Another Request
                </button>
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-6 py-2.5 rounded-full bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] font-bold text-xs transition-colors cursor-pointer"
                >
                  Return to Home
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleCustomOrderSubmit}
              className="p-6 sm:p-10 rounded-3xl bg-[#F8F0E5]/60 border border-[#E8D6C3] shadow-md space-y-6"
            >
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {errorMsg}
                </div>
              )}

              {/* Event Type & Batch Size */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2">
                    Event or Occasion Type *
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs font-semibold text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    required
                  >
                    <option value="Wedding Favor & Dessert Table">Wedding Favors &amp; Dessert Display</option>
                    <option value="Birthday & Anniversary Celebration Cake">Birthday &amp; Anniversary Cake / Brownie</option>
                    <option value="Corporate Gifting & Gala">Corporate Gifting / Brand Celebration</option>
                    <option value="Luxury Assorted Brownie Box Hamper">Assorted Brownie Box Hamper</option>
                    <option value="Custom Bento Cake Order">Custom Bento Cake Order</option>
                    <option value="Other Custom Inquiry">Other Custom Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2">
                    Select Weight *
                  </label>
                  <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Select Weight">
                    {(['½ KG', '1 KG'] as const).map((weightOpt) => (
                      <button
                        key={weightOpt}
                        type="button"
                        role="radio"
                        aria-checked={batchSize === weightOpt}
                        onClick={() => setBatchSize(weightOpt)}
                        className={`p-3 rounded-xl border-2 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          batchSize === weightOpt
                            ? 'bg-[#3B211B] text-[#E5A962] border-[#C47B55] shadow-xs'
                            : 'bg-white text-[#3B211B] border-[#E8D6C3] hover:border-[#C47B55]'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            batchSize === weightOpt ? 'text-[#E5A962]' : 'text-[#3B211B]/30'
                          }`}
                        />
                        <span>{weightOpt}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Preferred Flavors / Menu Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B]">
                    Preferred Brownies / Cakes ({selectedFlavors.length} Selected)
                  </label>
                  {selectedFlavors.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllFlavors}
                      className="text-[11px] text-[#3B211B]/60 hover:text-black font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {/* Selected Flavor Chips */}
                {selectedFlavors.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-white rounded-2xl border border-[#E8D6C3]">
                    {selectedFlavors.map((name) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C47B55]/15 text-[#3B211B] border border-[#C47B55]/30 text-xs font-semibold"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C47B55]" />
                        <span>{name}</span>
                        <button
                          type="button"
                          onClick={() => toggleFlavor(name)}
                          className="hover:text-red-700 ml-0.5 cursor-pointer"
                          title="Remove item"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                    Tap any menu item below or type your custom flavor request.
                  </div>
                )}

                {/* Add custom flavor text box */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customFlavorInput}
                    onChange={(e) => setCustomFlavorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomFlavor();
                      }
                    }}
                    placeholder="Type a custom flavor or cake design and press Add..."
                    className="flex-1 p-2.5 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomFlavor}
                    className="px-4 py-2 rounded-xl bg-[#3B211B] hover:bg-[#23120E] text-[#F8F0E5] text-xs font-bold cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#E5A962]" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Quick Pick Chips from Menu */}
                <div className="pt-1">
                  <span className="text-[11px] font-semibold text-[#3B211B]/70 block mb-1.5">
                    Quick Pick from Menu:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-white/70 rounded-xl border border-[#E8D6C3]">
                    {availableMenu.map((item) => {
                      const isChecked = selectedFlavors.includes(item.name);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleFlavor(item.name)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-[#C47B55] text-white border-[#C47B55] font-bold'
                              : 'bg-white text-[#3B211B] border-[#E8D6C3] hover:border-[#C47B55]'
                          }`}
                        >
                          {isChecked ? `✓ ${item.name}` : `+ ${item.name}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Event Date, Name, Phone, Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#C47B55]" />
                    Event or Delivery Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2">
                    Your Full Name *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#C47B55]" />
                    Contact Phone / WhatsApp Number *
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#C47B55]" />
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                    required
                  />
                </div>
              </div>

              {/* Mandatory Delivery Address */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2 flex items-center justify-between">
                  <span>Delivery Address *</span>
                  <span className="text-[10px] font-semibold text-[#C47B55] normal-case">Mandatory</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={deliveryAddress}
                  onChange={(e) => {
                    setDeliveryAddress(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter your complete delivery address (Door/Flat No., Street, Landmark, Area, City & Pincode) *"
                  className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] font-semibold focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                />
              </div>

              {/* Special Requests / Dietary Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#3B211B] mb-2">
                  Special Customization, Cake Message, or Dietary Requirements (Optional)
                </label>
                <textarea
                  rows={3}
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                  placeholder="e.g. Eggless batch, 'Happy Birthday' inscription on cake, gold ribbon packaging..."
                  className="w-full p-3 bg-white border border-[#E8D6C3] rounded-xl text-xs text-[#3B211B] focus:outline-none focus:ring-2 focus:ring-[#C47B55]"
                />
              </div>

              {/* Submit CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[#3B211B]/70">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Your custom order request will be saved directly with our bakery team.</span>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none px-8 py-3.5 rounded-full bg-[#C47B55] hover:bg-[#D98B5F] text-white font-bold text-sm tracking-wide shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isSubmitting ? 'Submitting Order...' : 'Submit Custom Order'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};

export default CustomOrdersPage;
