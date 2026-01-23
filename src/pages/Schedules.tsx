import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Mail,
  Clock, 
  Bell,
  User,
  Repeat,
  AlertCircle,
  Filter,
  X,
  UserPlus,
  ChevronDown,
  ChevronRight,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/hooks/useApi";
import { playUpdateBeep, playDeleteBeep, playErrorBeep } from "@/lib/sound";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { scheduleApi, clientApi } from "@/lib/api";

interface Client {
  id?: number;
  _id?: string;
  name: string;
  email?: string;
  phone?: string;
  businessType?: string;
  clientType?: "debtor" | "worker" | "other";
  notes?: string;
}

interface Schedule {
  id?: number;
  _id?: string;
  title: string;
  description?: string;
  clientId?: string | Client;
  dueDate: string | Date;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  amount?: number;
  status: 'pending' | 'completed' | 'cancelled';
  notifyUser: boolean;
  notifyClient: boolean;
  userNotificationMessage?: string;
  clientNotificationMessage?: string;
  advanceNotificationDays: number;
  repeatUntil?: string | Date;
}

interface ScheduleFormData {
  title: string;
  description: string;
  clientId: string;
  // Client information fields (for creating new client)
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientBusinessType: string;
  clientType: "debtor" | "worker" | "other";
  dueDate: string;
  frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  amount: string;
  notifyUser: boolean;
  notifyClient: boolean;
  userNotificationMessage: string;
  clientNotificationMessage: string;
  advanceNotificationDays: string;
  repeatUntil: string;
}

const Schedules = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    items: schedules,
    isLoading,
    add: addSchedule,
    update: updateSchedule,
    remove: removeSchedule,
    refresh: refreshSchedules,
  } = useApi<Schedule>({
    endpoint: "schedules",
    defaultValue: [],
    onError: (error) => {
      console.error("Error with schedules:", error);
      toast({
        title: "Error",
        description: "Failed to load schedules. Please try again.",
        variant: "destructive",
      });
    },
  });

  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  const [scheduleToComplete, setScheduleToComplete] = useState<Schedule | null>(null);
  const [completionMessage, setCompletionMessage] = useState("");
  const [sendCompletionEmail, setSendCompletionEmail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4; // Basic Info, Client Details, Frequency, Notifications
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientForm, setClientForm] = useState<{
    name: string;
    email: string;
    phone: string;
    businessType: string;
    clientType: "debtor" | "worker" | "other";
    notes: string;
  }>({
    name: "",
    email: "",
    phone: "",
    businessType: "",
    clientType: "other",
    notes: "",
  });
  const [formData, setFormData] = useState<ScheduleFormData>({
    title: "",
    description: "",
    clientId: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientBusinessType: "",
    clientType: "other",
    dueDate: "",
    frequency: "once",
    amount: "",
    notifyUser: true,
    notifyClient: false,
    userNotificationMessage: "",
    clientNotificationMessage: "",
    advanceNotificationDays: "0",
    repeatUntil: "",
  });
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteClientDialogOpen, setDeleteClientDialogOpen] = useState(false);

  // Load clients function
  const loadClients = useCallback(async () => {
      try {
      console.log("Loading clients from database...");
        const response = await clientApi.getAll();
      console.log("Clients API response:", response);
      
      if (response && response.data) {
        console.log(`Loaded ${response.data.length} clients from database`);
          setClients(response.data);
      } else {
        console.warn("No data in response:", response);
        setClients([]);
        }
    } catch (error: any) {
        console.error("Error loading clients:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to load clients from database.",
        variant: "destructive",
      });
      setClients([]);
    }
  }, [toast]);

  // Load clients on mount
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  // Get schedules for a specific client
  const getSchedulesForClient = useCallback((clientId: string) => {
    return schedules.filter((s) => {
      const sid = (s as any).clientId;
      const linkedId = typeof sid === "object" ? (sid?._id || sid?.id) : sid;
      return linkedId?.toString() === clientId;
    }).sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      return dateA - dateB;
    });
  }, [schedules]);

  // Toggle client expansion
  const toggleClientExpansion = (clientId: string) => {
    setExpandedClients((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  // Check URL params for clientId and auto-open create modal
  useEffect(() => {
    const clientId = searchParams.get("clientId");
    const create = searchParams.get("create");
    
    if (clientId && create === "true" && clients.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const existingClient = clients.find((c: any) => ((c._id || c.id)?.toString()) === clientId);
      
      setFormData({
        title: "",
        description: "",
        clientId: clientId,
        clientName: existingClient?.name || "",
        clientEmail: existingClient?.email || "",
        clientPhone: existingClient?.phone || "",
        clientBusinessType: existingClient?.businessType || "",
        clientType: existingClient?.clientType || "other",
        // Format for datetime-local: YYYY-MM-DDTHH:mm (default to 9:00 AM)
        dueDate: (() => {
          const date = new Date(tomorrow);
          date.setHours(9, 0, 0, 0);
          return date.toISOString().slice(0, 16);
        })(),
        frequency: "once",
        amount: "",
        notifyUser: true,
        notifyClient: true,
        userNotificationMessage: "",
        clientNotificationMessage: "",
        advanceNotificationDays: "0",
        repeatUntil: "",
      });
      
      setIsModalOpen(true);
      setEditingSchedule(null);
      setSearchParams({});
    }
  }, [searchParams, clients, setSearchParams]);

  // If URL has clientId (without create=true), expand that client
  useEffect(() => {
    const clientId = searchParams.get("clientId");
    const create = searchParams.get("create");
    if (clientId && create !== "true") {
      setExpandedClients(new Set([clientId]));
    }
  }, [searchParams]);

  const filteredClients = useMemo(() => {
    let filtered = clients;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const clientId = ((c as any)._id || c.id)?.toString() || "";
        const clientMatches = 
          c.name.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.businessType?.toLowerCase().includes(query) ||
          c.phone?.toLowerCase().includes(query);
        
        // Also check if any schedule for this client matches
        const clientSchedules = getSchedulesForClient(clientId);
        const scheduleMatches = clientSchedules.some((s) =>
          s.title.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      );
    
        return clientMatches || scheduleMatches;
      });
    }

    // Filter by client
    if (clientFilter !== "all") {
      filtered = filtered.filter((c) => {
        const clientId = ((c as any)._id || c.id)?.toString();
        return clientId === clientFilter;
      });
    }
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, searchQuery, clientFilter, getSchedulesForClient]);


  const getClientName = (clientId?: string | Client) => {
    if (!clientId) return "No Client";
    if (typeof clientId === "object") return clientId.name;
    const client = clients.find((c) => (c._id || c.id) === clientId);
    return client?.name || "Unknown Client";
  };

  const getClientInfo = (clientId?: string | Client): Client | undefined => {
    if (!clientId) return undefined;
    if (typeof clientId === "object") return clientId as Client;
    return clients.find((c) => (c._id || c.id) === clientId);
  };

  const openClientCreateModal = () => {
    setClientForm({
      name: "",
      email: "",
      phone: "",
      businessType: "",
      clientType: "other",
      notes: "",
    });
    setIsClientModalOpen(true);
  };

  const handleCreateClient = async () => {
    if (editingClient) {
      // Handle update
      const clientId = (editingClient as any)._id || editingClient.id;
      if (!clientId) return;
      
      setIsCreatingClient(true);
      try {
        await clientApi.update(clientId.toString(), {
          name: clientForm.name.trim(),
          email: clientForm.email.trim(),
          phone: clientForm.phone.trim() || undefined,
          businessType: clientForm.businessType.trim(),
          clientType: clientForm.clientType,
          notes: clientForm.notes.trim() || undefined,
        });
        
        // Refresh clients from database
        await loadClients();
        
        playUpdateBeep();
        toast({ title: "Client Updated", description: "Client has been updated successfully." });
        setIsClientModalOpen(false);
        setEditingClient(null);
        setClientForm({
          name: "",
          email: "",
          phone: "",
          businessType: "",
          clientType: "other",
          notes: "",
        });
      } catch (e: any) {
        playErrorBeep();
        toast({
          title: "Update Client Failed",
          description: e?.response?.error || e?.message || "Failed to update client. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsCreatingClient(false);
      }
      return;
    }
    
    // Handle create (existing code)
    if (!clientForm.name.trim()) {
      toast({ title: "Validation Error", description: "Client name is required.", variant: "destructive" });
      return;
    }
    if (!clientForm.email.trim()) {
      toast({ title: "Validation Error", description: "Client email is required.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientForm.email.trim())) {
      toast({ title: "Validation Error", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    if (!clientForm.businessType.trim()) {
      toast({ title: "Validation Error", description: "Business type is required.", variant: "destructive" });
      return;
    }

    setIsCreatingClient(true);
    try {
      const res = await clientApi.create({
        name: clientForm.name.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim() || undefined,
        businessType: clientForm.businessType.trim(),
        clientType: clientForm.clientType,
        notes: clientForm.notes.trim() || undefined,
      });

      const created = res.data as any;
      const createdId = created?._id || created?.id;
      
      // Refresh clients from database to get all registered clients
      await loadClients();
      
      if (createdId) {
        setFormData((prev) => ({
          ...prev,
          clientId: createdId.toString(),
          notifyClient: true, // smart default when you just created a client
        }));
      }

      playUpdateBeep();
      toast({ title: "Client Created", description: "Client has been created and selected." });
      setIsClientModalOpen(false);
      setClientForm({
        name: "",
        email: "",
        phone: "",
        businessType: "",
        clientType: "other",
        notes: "",
      });
    } catch (e: any) {
      playErrorBeep();
      toast({
        title: "Create Client Failed",
        description: e?.response?.error || e?.message || "Failed to create client. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingClient(false);
    }
  };

  const openAddModal = () => {
    setEditingSchedule(null);
    setCurrentStep(1); // Reset to first step
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const urlClientId = searchParams.get("clientId");
    const existingClient = urlClientId ? clients.find((c: any) => ((c._id || c.id)?.toString()) === urlClientId) : null;
    
    setFormData({
      title: "",
      description: "",
      clientId: urlClientId || "",
      clientName: existingClient?.name || "",
      clientEmail: existingClient?.email || "",
      clientPhone: existingClient?.phone || "",
      clientBusinessType: existingClient?.businessType || "",
      clientType: existingClient?.clientType || "other",
      // Format for datetime-local: YYYY-MM-DDTHH:mm (default to 9:00 AM)
      dueDate: (() => {
        const date = new Date(tomorrow);
        date.setHours(9, 0, 0, 0);
        return date.toISOString().slice(0, 16);
      })(),
      frequency: "once",
      amount: "",
      notifyUser: true,
      notifyClient: false,
      userNotificationMessage: "",
      clientNotificationMessage: "",
      advanceNotificationDays: "0",
      repeatUntil: "",
    });
    setIsModalOpen(true);
  };

  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setCurrentStep(1); // Reset to first step
    const clientId = typeof schedule.clientId === "object" 
      ? (schedule.clientId._id || schedule.clientId.id) 
      : schedule.clientId;
    
    // Ensure clientId is set - if schedule has no client, require user to select one
    if (!clientId) {
      playErrorBeep();
      toast({
        title: "Invalid Schedule",
        description: "This schedule has no assigned client. Please assign a client to continue.",
        variant: "destructive",
      });
      return;
    }
    
    const clientInfo = typeof schedule.clientId === "object" ? schedule.clientId : 
      clients.find((c: any) => ((c._id || c.id)?.toString()) === clientId?.toString());
    
    setFormData({
      title: schedule.title,
      description: schedule.description || "",
      clientId: clientId.toString(),
      clientName: clientInfo && typeof clientInfo === "object" ? clientInfo.name : "",
      clientEmail: clientInfo && typeof clientInfo === "object" ? (clientInfo.email || "") : "",
      clientPhone: clientInfo && typeof clientInfo === "object" ? (clientInfo.phone || "") : "",
      clientBusinessType: clientInfo && typeof clientInfo === "object" ? (clientInfo.businessType || "") : "",
      clientType: clientInfo && typeof clientInfo === "object" ? (clientInfo.clientType || "other") : "other",
      // Format datetime-local: YYYY-MM-DDTHH:mm (convert to local time)
      dueDate: (() => {
        const date = new Date(schedule.dueDate);
        // Get local date components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      })(),
      frequency: schedule.frequency,
      amount: schedule.amount?.toString() || "",
      notifyUser: schedule.notifyUser,
      notifyClient: schedule.notifyClient,
      userNotificationMessage: schedule.userNotificationMessage || "",
      clientNotificationMessage: schedule.clientNotificationMessage || "",
      advanceNotificationDays: schedule.advanceNotificationDays.toString(),
      repeatUntil: schedule.repeatUntil 
        ? new Date(schedule.repeatUntil).toISOString().split("T")[0] 
        : "",
    });
    setIsModalOpen(true);
  };

  // Step navigation functions
  const nextStep = () => {
    // Validate current step before moving forward
    if (currentStep === 1) {
      // Validate Basic Information
      if (!formData.title.trim()) {
        playErrorBeep();
        toast({
          title: "Validation Error",
          description: "Schedule title is required.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.dueDate) {
        playErrorBeep();
        toast({
          title: "Validation Error",
          description: "Due date is required.",
          variant: "destructive",
        });
        return;
      }
    } else if (currentStep === 2) {
      // Validate Client Details
      if (!formData.clientName.trim()) {
        playErrorBeep();
        toast({
          title: "Validation Error",
          description: "Client name is required.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.clientEmail.trim()) {
        playErrorBeep();
        toast({
          title: "Validation Error",
          description: "Client email is required.",
          variant: "destructive",
        });
        return;
      }
      if (!formData.clientBusinessType.trim()) {
        playErrorBeep();
        toast({
          title: "Validation Error",
          description: "Business type is required.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Schedule title is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.dueDate) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Due date is required.",
        variant: "destructive",
      });
      return;
    }

    // Validate client information
    if (!formData.clientName.trim()) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Client name is required.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.clientEmail.trim()) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Client email is required.",
        variant: "destructive",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail.trim())) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.clientBusinessType.trim()) {
      playErrorBeep();
      toast({
        title: "Validation Error",
        description: "Business type is required.",
        variant: "destructive",
      });
      return;
    }

    try {
      let finalClientId = formData.clientId;

      // If no clientId is set, check if client exists by email, otherwise create new client
      if (!finalClientId) {
        const existingClient = clients.find(
          (c: any) => c.email?.toLowerCase() === formData.clientEmail.trim().toLowerCase()
        );
        
        if (existingClient) {
          finalClientId = (existingClient._id || existingClient.id)?.toString();
        } else {
          // Create new client
          try {
            const clientRes = await clientApi.create({
              name: formData.clientName.trim(),
              email: formData.clientEmail.trim(),
              phone: formData.clientPhone.trim() || undefined,
              businessType: formData.clientBusinessType.trim(),
              clientType: formData.clientType,
            });
            const createdClient = clientRes.data as any;
            finalClientId = (createdClient._id || createdClient.id)?.toString();
            await loadClients(); // Refresh clients list
          } catch (clientError: any) {
            playErrorBeep();
            toast({
              title: "Client Creation Failed",
              description: clientError?.response?.error || clientError?.message || "Failed to create client. Please try again.",
              variant: "destructive",
            });
            return;
          }
        }
      }

      const scheduleData: any = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        clientId: finalClientId,
        // Ensure full datetime is preserved with time component
        dueDate: new Date(formData.dueDate).toISOString(),
        frequency: formData.frequency,
        amount: formData.amount ? parseFloat(formData.amount) : undefined,
        notifyUser: formData.notifyUser,
        notifyClient: formData.notifyClient,
        userNotificationMessage: formData.userNotificationMessage.trim() || undefined,
        clientNotificationMessage: formData.clientNotificationMessage.trim() || undefined,
        advanceNotificationDays: parseInt(formData.advanceNotificationDays) || 0,
        repeatUntil: formData.repeatUntil ? new Date(formData.repeatUntil).toISOString() : undefined,
      };

      if (editingSchedule) {
        // Update client information if it has changed
        const currentClientId = typeof editingSchedule.clientId === "object" 
          ? (editingSchedule.clientId._id || editingSchedule.clientId.id) 
          : editingSchedule.clientId;
        
        if (finalClientId === currentClientId?.toString()) {
          // Same client - check if client info needs updating
          const currentClient = clients.find((c: any) => ((c._id || c.id)?.toString()) === finalClientId);
          if (currentClient) {
            const clientNeedsUpdate = 
              currentClient.name !== formData.clientName.trim() ||
              currentClient.email !== formData.clientEmail.trim() ||
              currentClient.phone !== formData.clientPhone.trim() ||
              currentClient.businessType !== formData.clientBusinessType.trim() ||
              currentClient.clientType !== formData.clientType;
            
            if (clientNeedsUpdate) {
              try {
                await clientApi.update(finalClientId, {
                  name: formData.clientName.trim(),
                  email: formData.clientEmail.trim(),
                  phone: formData.clientPhone.trim() || undefined,
                  businessType: formData.clientBusinessType.trim(),
                  clientType: formData.clientType,
                });
                await loadClients(); // Refresh clients list
              } catch (clientError: any) {
                console.error("Failed to update client:", clientError);
                // Continue with schedule update even if client update fails
              }
            }
          }
        }

        const updatedSchedule: Schedule = {
          ...editingSchedule,
          ...scheduleData,
        };
        await updateSchedule(updatedSchedule);
        await refreshSchedules();
        playUpdateBeep();
        toast({
          title: "Schedule Updated",
          description: "Schedule and client information have been updated successfully.",
        });
      } else {
        await addSchedule(scheduleData);
        await refreshSchedules();
        playUpdateBeep();
        toast({
          title: "Schedule Created",
          description: "Schedule has been created successfully.",
        });
      }
      setIsModalOpen(false);
      setEditingSchedule(null);
      // Reset form
      setFormData({
        title: "",
        description: "",
        clientId: "",
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        clientBusinessType: "",
        clientType: "other",
        dueDate: "",
        frequency: "once",
        amount: "",
        notifyUser: true,
        notifyClient: false,
        userNotificationMessage: "",
        clientNotificationMessage: "",
        advanceNotificationDays: "0",
        repeatUntil: "",
      });
    } catch (error) {
      playErrorBeep();
      toast({
        title: editingSchedule ? "Update Failed" : "Create Failed",
        description: `Failed to ${editingSchedule ? "update" : "create"} schedule. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleCompleteClick = (schedule: Schedule) => {
    setScheduleToComplete(schedule);
    setCompletionMessage("");
    setSendCompletionEmail(false);
    setCompleteDialogOpen(true);
  };

  const handleCompleteConfirm = async () => {
    if (!scheduleToComplete) return;
    
    try {
      const scheduleId = (scheduleToComplete as any)._id || scheduleToComplete.id;
      const completionData: any = {};
      
      // Send email if checkbox is checked (message is optional)
      if (sendCompletionEmail) {
        completionData.completionMessage = completionMessage.trim() || undefined;
        completionData.notifyClient = true;
        completionData.notifyUser = true;
      }
      
      await scheduleApi.complete(scheduleId, completionData);
      await refreshSchedules();
      playUpdateBeep();
      toast({
        title: "Schedule Completed",
        description: sendCompletionEmail
          ? "Schedule has been marked as completed and notification sent." 
          : "Schedule has been marked as completed.",
      });
      setCompleteDialogOpen(false);
      setScheduleToComplete(null);
      setCompletionMessage("");
      setSendCompletionEmail(false);
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Error",
        description: "Failed to complete schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (schedule: Schedule) => {
    setScheduleToDelete(schedule);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!scheduleToDelete) return;
    
    try {
      await removeSchedule(scheduleToDelete);
      await refreshSchedules();
      playDeleteBeep();
      toast({
        title: "Schedule Deleted",
        description: "Schedule has been deleted successfully.",
      });
      setDeleteDialogOpen(false);
      setScheduleToDelete(null);
    } catch (error) {
      playErrorBeep();
      toast({
        title: "Delete Failed",
        description: "Failed to delete schedule. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClientConfirm = async () => {
    if (!clientToDelete) return;
    
    try {
      const clientId = (clientToDelete as any)._id || clientToDelete.id;
      const clientIdStr = clientId?.toString() || "";
      const clientSchedules = getSchedulesForClient(clientIdStr);
      
      // Check if client has schedules
      if (clientSchedules.length > 0) {
        playErrorBeep();
        toast({
          title: "Cannot Delete Client",
          description: `This client has ${clientSchedules.length} schedule(s) assigned. Please delete or reassign the schedules first.`,
          variant: "destructive",
        });
        setDeleteClientDialogOpen(false);
        setClientToDelete(null);
        return;
      }

      await clientApi.delete(clientIdStr);
      await loadClients();
      playDeleteBeep();
      toast({
        title: "Client Deleted",
        description: "Client has been deleted successfully.",
      });
      setDeleteClientDialogOpen(false);
      setClientToDelete(null);
    } catch (error: any) {
      playErrorBeep();
      toast({
        title: "Delete Failed",
        description: error?.response?.error || error?.message || "Failed to delete client. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 border-green-300";
      case "cancelled":
        return "bg-gray-100 text-gray-700 border-gray-300";
      default:
        return "bg-blue-100 text-blue-700 border-blue-300";
    }
  };

  const isOverdue = (dueDate: string | Date) => {
    const due = new Date(dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < now && due.toDateString() !== now.toDateString();
  };

  const getDaysUntilDue = (dueDate: string | Date) => {
    const due = new Date(dueDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const upcomingSchedules = useMemo(() => {
    return schedules.filter((s) => {
      const dueDate = new Date(s.dueDate);
      const now = new Date();
      return dueDate >= now && s.status === "pending";
    }).slice(0, 5);
  }, [schedules]);

  const overdueSchedules = useMemo(() => {
    return schedules.filter((s) => isOverdue(s.dueDate) && s.status === "pending");
  }, [schedules]);

  // Schedules Page Skeleton
  const SchedulesSkeleton = () => (
    <AppLayout title="Schedules">
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="bg-white shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden rounded-lg">
          <div className="bg-white border-b border-gray-200 px-4 py-6 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="overflow-auto flex-1">
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );

  if (isLoading) {
    return <SchedulesSkeleton />;
  }

  return (
    <AppLayout title="Schedules & Reminders">
      <div className="flex flex-col gap-4 pb-4">
        {/* Stats Section */}
        <div className="form-card border-transparent flex-shrink-0 bg-blue-500 border-blue-600">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="section-title flex items-center gap-2 text-white">
              <CalendarIcon size={20} className="text-white" />
              Schedules & Reminders
            </h3>
            <Button
              onClick={openAddModal}
              className="bg-white text-blue-600 hover:bg-blue-50 font-semibold px-4 py-2 gap-2 w-full sm:w-auto"
            >
              <Plus size={18} />
              <span className="hidden xs:inline">New Schedule</span>
              <span className="xs:hidden">New</span>
            </Button>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-blue-600 font-medium mb-1">Total</div>
              <div className="text-2xl font-semibold text-blue-700">{schedules.length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-blue-600 font-medium mb-1">Upcoming</div>
              <div className="text-2xl font-semibold text-blue-700">{upcomingSchedules.length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-red-600 font-medium mb-1">Overdue</div>
              <div className="text-2xl font-semibold text-red-700">{overdueSchedules.length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-green-600 font-medium mb-1">Completed</div>
              <div className="text-2xl font-semibold text-green-700">
                {schedules.filter(s => s.status === "completed").length}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="form-card border-transparent flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" />
              <Input
                placeholder="Search clients or schedules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-field"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="input-field w-full sm:w-48">
                <Filter size={16} className="mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="input-field w-full sm:w-48">
                <CalendarIcon size={16} className="mr-2" />
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger className="input-field w-full sm:w-48">
                <Repeat size={16} className="mr-2" />
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Frequency</SelectItem>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="input-field w-full sm:w-48">
                <User size={16} className="mr-2" />
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => {
                  const clientId = ((client as any)._id || client.id)?.toString();
                  return (
                    <SelectItem key={clientId} value={clientId}>
                      {client.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content Section */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="p-2 sm:p-4">
              {filteredClients.length > 0 ? (
                <div className="overflow-x-auto -mx-2 sm:mx-0 rounded-lg border border-gray-200">
                  <table className="w-full border-collapse min-w-[800px] sm:min-w-0">
                    <thead className="sticky top-0 z-10 bg-gray-100 border-b-2 border-gray-300">
                      <tr>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6 w-10 sm:w-12"></th>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6">Client Name</th>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6 hidden md:table-cell">Business Type</th>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6 hidden lg:table-cell">Email</th>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6 hidden lg:table-cell">Phone</th>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6">Schedules</th>
                        <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-3 sm:py-4 px-3 sm:px-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredClients.map((client, index) => {
                        const clientId = (client as any)._id || client.id;
                        const clientIdStr = clientId?.toString() || "";
                        const isExpanded = expandedClients.has(clientIdStr);
                        const clientSchedules = getSchedulesForClient(clientIdStr);
                        
                        // Apply all filters to schedules
                        let filteredClientSchedules = clientSchedules;
                        
                        // Status filter
                        if (statusFilter !== "all") {
                          filteredClientSchedules = filteredClientSchedules.filter(s => s.status === statusFilter);
                        }
                        
                        // Date filter
                        if (dateFilter !== "all") {
                          const now = new Date();
                          now.setHours(0, 0, 0, 0);
                          const today = new Date(now);
                          const tomorrow = new Date(now);
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          const nextWeek = new Date(now);
                          nextWeek.setDate(nextWeek.getDate() + 7);
                          const nextMonth = new Date(now);
                          nextMonth.setMonth(nextMonth.getMonth() + 1);
                          
                          filteredClientSchedules = filteredClientSchedules.filter(s => {
                            const dueDate = new Date(s.dueDate);
                            dueDate.setHours(0, 0, 0, 0);
                            
                            switch (dateFilter) {
                              case "today":
                                return dueDate.getTime() === today.getTime();
                              case "thisWeek":
                                return dueDate >= today && dueDate <= nextWeek;
                              case "thisMonth":
                                return dueDate >= today && dueDate <= nextMonth;
                              case "overdue":
                                return dueDate < today && s.status === "pending";
                              case "upcoming":
                                return dueDate > today && s.status === "pending";
                              default:
                                return true;
                            }
                          });
                        }
                        
                        // Frequency filter
                        if (frequencyFilter !== "all") {
                          filteredClientSchedules = filteredClientSchedules.filter(s => s.frequency === frequencyFilter);
                        }
                        
                        return (
                          <>
                            <tr
                              key={clientId}
                              className={cn(
                                "border-b border-gray-200",
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              )}
                            >
                              <td className="py-3 sm:py-4 px-3 sm:px-6">
                                {clientSchedules.length > 0 && (
                                  <button
                                    onClick={() => toggleClientExpansion(clientIdStr)}
                                    className="p-1.5 sm:p-2 text-blue-600 rounded"
                                  >
                                    {isExpanded ? <ChevronDown size={16} className="sm:w-[18px] sm:h-[18px]" /> : <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />}
                                  </button>
                                )}
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6">
                                <div className="text-xs sm:text-sm font-semibold text-gray-900">{client.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5 md:hidden">{client.businessType || "-"}</div>
                                <div className="text-xs text-gray-500 mt-0.5 lg:hidden">{client.email || "-"}</div>
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6 hidden md:table-cell">
                                <div className="text-xs sm:text-sm text-gray-700">{client.businessType || "-"}</div>
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6 hidden lg:table-cell">
                                <div className="text-xs sm:text-sm text-gray-700 truncate max-w-[150px]">{client.email || "-"}</div>
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6 hidden lg:table-cell">
                                <div className="text-xs sm:text-sm text-gray-700">{client.phone || "-"}</div>
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6">
                                <div className="inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-gray-100 text-gray-700">
                                  {clientSchedules.length} schedule{clientSchedules.length !== 1 ? 's' : ''}
                                </div>
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6">
                                <div className="flex gap-1 sm:gap-2">
                                  <button
                                    onClick={() => {
                                      setClientToDelete(client);
                                      setDeleteClientDialogOpen(true);
                                    }}
                                    className="p-1.5 sm:p-2 text-red-600 rounded"
                                    title="Delete client"
                                  >
                                    <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {isExpanded && filteredClientSchedules.length > 0 && (
                              <tr key={`${clientId}-schedules`}>
                                <td colSpan={7} className="py-0 px-0 bg-gray-50 border-b-2 border-gray-200">
                                  <div className="px-3 sm:px-6 py-3 sm:py-4">
                                    <div className="mb-2 sm:mb-3">
                                      <h4 className="text-xs sm:text-sm font-semibold text-gray-700">Schedules for {client.name}</h4>
                                    </div>
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
                                      <table className="w-full min-w-[600px] sm:min-w-0">
                                        <thead>
                                          <tr className="bg-white border-b border-gray-200">
                                            <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2 sm:py-3 px-2 sm:px-4">Title</th>
                                            <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2 sm:py-3 px-2 sm:px-4">Status</th>
                                            <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2 sm:py-3 px-2 sm:px-4">Due Date</th>
                                            <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">Amount</th>
                                            <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2 sm:py-3 px-2 sm:px-4 hidden md:table-cell">Notifications</th>
                                            <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2 sm:py-3 px-2 sm:px-4">Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {filteredClientSchedules.map((schedule, sIndex) => {
                    const scheduleId = (schedule as any)._id || schedule.id;
                    const overdue = isOverdue(schedule.dueDate);
                    const daysUntil = getDaysUntilDue(schedule.dueDate);
                    const isToday = daysUntil === 0;
                    
                    return (
                                              <tr 
                        key={scheduleId}
                        className={cn(
                                                  "border-b border-gray-200",
                                                  sIndex % 2 === 0 ? "bg-white" : "bg-gray-50"
                                                )}
                                              >
                                                <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                  <div>
                                                    <div className="text-xs sm:text-sm font-medium text-gray-900">{schedule.title}</div>
                                                    {schedule.description && (
                                                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{schedule.description}</div>
                                                    )}
                                                    {schedule.amount && (
                                                      <div className="text-xs font-semibold text-green-600 mt-1 sm:hidden">
                                                        {schedule.amount.toLocaleString()} RWF
                              </div>
                                                    )}
                              </div>
                                                </td>
                                                <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                                  <span className={cn(
                                                      "inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-xs font-semibold",
                                                      schedule.status === "completed" && "bg-green-100 text-green-700",
                                                      schedule.status === "pending" && "bg-yellow-100 text-yellow-700",
                                                      schedule.status === "cancelled" && "bg-gray-100 text-gray-700"
                                  )}>
                                    {schedule.status}
                                  </span>
                                  {overdue && schedule.status === "pending" && (
                                                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                      Overdue
                                    </span>
                                  )}
                                  {isToday && !overdue && schedule.status === "pending" && (
                                                      <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                      Due Today
                                    </span>
                                  )}
                                </div>
                                                </td>
                                                <td className="py-2 sm:py-3 px-2 sm:px-4">
                                <div>
                                                    <div className="text-xs sm:text-sm font-medium text-gray-900">
                                    {new Date(schedule.dueDate).toLocaleDateString('en-US', { 
                                      weekday: 'short',
                                      month: 'short', 
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </div>
                                  {schedule.status === "pending" && (
                                    <div className={cn(
                                                        "text-xs mt-0.5 sm:mt-1 font-medium",
                                                        overdue && "text-red-600",
                                                        isToday && !overdue && "text-blue-600",
                                      !overdue && !isToday && "text-gray-500"
                                    )}>
                                      {overdue ? `${Math.abs(daysUntil)} days overdue` : 
                                       isToday ? "Due today" : 
                                       daysUntil === 1 ? "Due tomorrow" : 
                                       `${daysUntil} days remaining`}
                                    </div>
                                  )}
                                </div>
                                                </td>
                                                <td className="py-2 sm:py-3 px-2 sm:px-4 hidden sm:table-cell">
                                                  {schedule.amount ? (
                                                    <div className="text-xs sm:text-sm font-semibold text-green-600">
                                      {schedule.amount.toLocaleString()} RWF
                                    </div>
                                                  ) : (
                                                    <span className="text-xs sm:text-sm text-gray-400">-</span>
                                                  )}
                                                </td>
                                                <td className="py-2 sm:py-3 px-2 sm:px-4 hidden md:table-cell">
                                                  {(schedule.notifyUser || schedule.notifyClient) ? (
                                                    <div className="space-y-1.5">
                                                      <div className="text-xs text-gray-600">
                                                        {schedule.notifyUser && "You"} {schedule.notifyUser && schedule.notifyClient && "&"} {schedule.notifyClient && "Client"}
                                                        {schedule.advanceNotificationDays > 0 && ` (${schedule.advanceNotificationDays}d)`}
                                  </div>
                                                      {(schedule as any).lastNotified && (
                                                        <div className="flex items-center gap-1.5 text-xs text-green-600">
                                                          <Mail size={10} className="sm:w-3 sm:h-3 text-green-600" />
                                                          <span className="font-medium">Sent:</span>
                                                          <span>{new Date((schedule as any).lastNotified).toLocaleString('en-US', { 
                                                            month: 'short', 
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                          })}</span>
                                </div>
                              )}
                            </div>
                                                  ) : (
                                                    <span className="text-xs sm:text-sm text-gray-400">-</span>
                                                  )}
                                                </td>
                                                <td className="py-2 sm:py-3 px-2 sm:px-4">
                                                  <div className="flex gap-1 sm:gap-2">
                            {schedule.status === "pending" && (
                              <button
                                onClick={() => handleCompleteClick(schedule)}
                                                        className="p-1.5 sm:p-2 text-green-600 rounded"
                                title="Mark as completed"
                              >
                                                        <CheckCircle2 size={14} className="sm:w-4 sm:h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(schedule)}
                                                      className="p-1.5 sm:p-2 text-blue-600 rounded"
                              title="Edit schedule"
                            >
                                                      <Pencil size={14} className="sm:w-4 sm:h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(schedule)}
                                                      className="p-1.5 sm:p-2 text-red-600 rounded"
                              title="Delete schedule"
                            >
                                                      <Trash2 size={14} className="sm:w-4 sm:h-4" />
                            </button>
                          </div>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                        </div>
                      </div>
                                </td>
                              </tr>
                            )}
                          </>
                    );
                  })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 sm:py-16 bg-white rounded border border-dashed border-gray-300 px-4">
                  <User size={48} className="sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300" />
                  <p className="text-base sm:text-lg font-semibold text-gray-400 mb-2">
                    {searchQuery ? "No clients found" : "No clients yet"}
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 mb-4">
                    {searchQuery ? "Try adjusting your search terms" : "Create your first client to get started"}
                  </p>
                  {!searchQuery && (
                    <Button
                      onClick={openAddModal}
                      className="bg-blue-600 text-white hover:bg-blue-700 text-sm sm:text-base px-4 sm:px-6"
                    >
                      <Plus size={16} className="sm:w-[18px] sm:h-[18px] mr-2" />
                      Create Schedule
                    </Button>
                  )}
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        setIsModalOpen(open);
        if (!open) {
          setCurrentStep(1); // Reset step when modal closes
        }
      }}>
        <DialogContent className="bg-white max-w-2xl w-[95vw] sm:w-full max-h-[90vh] sm:max-h-[85vh] overflow-y-auto mx-2 sm:mx-4">
          <DialogHeader className="border-b border-blue-200 pb-3 sm:pb-4">
            <DialogTitle className="text-lg sm:text-xl font-semibold text-blue-700">
              {editingSchedule ? "Edit Schedule" : "Create New Schedule"}
            </DialogTitle>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {editingSchedule ? "Update schedule details and notification settings" : "Set up a payment reminder, worker payment schedule, or any recurring task"}
            </p>
            
            {/* Progress Indicator */}
            <div className="mt-3 sm:mt-4 flex items-center justify-between gap-1 sm:gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div className={cn(
                      "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-semibold",
                      currentStep >= step 
                        ? "bg-blue-600 text-white" 
                        : "bg-gray-200 text-gray-600"
                    )}>
                      {step}
                    </div>
                    <span className={cn(
                      "text-[10px] sm:text-xs mt-0.5 sm:mt-1 text-center",
                      currentStep >= step ? "text-blue-600 font-medium" : "text-gray-500"
                    )}>
                      {step === 1 && "Basic"}
                      {step === 2 && "Client"}
                      {step === 3 && "Freq"}
                      {step === 4 && "Notify"}
                    </span>
                  </div>
                  {step < 4 && (
                    <div className={cn(
                      "h-0.5 flex-1 mx-1 sm:mx-2",
                      currentStep > step ? "bg-blue-600" : "bg-gray-200"
                    )} />
                  )}
                </div>
              ))}
            </div>
          </DialogHeader>
          
          <div className="py-4 sm:py-6">
            {/* Step 1: Basic Information */}
            {currentStep === 1 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                <CalendarIcon size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-blue-700">Basic Information</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    Schedule Title <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Monthly Payment - Client X, Weekly Worker Payment"
                    className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                  />
                  <p className="text-xs text-gray-500">A clear title helps you identify this schedule quickly</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    Due Date & Time <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    type="datetime-local"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded h-10"
                  />
                  <p className="text-xs text-gray-500">When this schedule is due</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add any additional details, notes, or context about this schedule..."
                  className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-gray-500 rounded"
                  rows={3}
                />
                <p className="text-xs text-gray-500">Optional: Add context or important notes</p>
              </div>
            </div>
            )}

            {/* Step 2: Client & Amount Section */}
            {currentStep === 2 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                <User size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-blue-700">Client & Payment Details</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    Client Name <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    placeholder="Enter client name"
                    className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                  />
                  </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    Email <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    placeholder="client@example.com"
                    className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">
                    Business Type <span className="text-red-600">*</span>
                  </Label>
                  <Input
                    value={formData.clientBusinessType}
                    onChange={(e) => setFormData({ ...formData, clientBusinessType: e.target.value })}
                    placeholder="e.g., Starlink Internet, Worker Payments"
                    className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Phone</Label>
                  <Input
                    type="tel"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    placeholder="+250 7xx xxx xxx"
                    className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Client Type</Label>
                  <Select
                    value={formData.clientType} 
                    onValueChange={(value: "debtor" | "worker" | "other") => setFormData({ ...formData, clientType: value })}
                  >
                    <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debtor">Debtor (owes money)</SelectItem>
                      <SelectItem value="worker">Worker (needs to be paid)</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Amount (RWF)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                  />
                  <p className="text-xs text-gray-500">Payment amount or reminder value (optional)</p>
                </div>
              </div>
            </div>
            )}

            {/* Step 3: Schedule Frequency Section */}
            {currentStep === 3 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                <Repeat size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-blue-700">Schedule Frequency</h3>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}>
                    <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="once">Once (One-time schedule)</SelectItem>
                      <SelectItem value="daily">Daily (Every day)</SelectItem>
                      <SelectItem value="weekly">Weekly (Every week)</SelectItem>
                      <SelectItem value="monthly">Monthly (Every month)</SelectItem>
                      <SelectItem value="yearly">Yearly (Every year)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {formData.frequency === "once" && "This schedule will occur only once"}
                    {formData.frequency === "daily" && "This schedule will repeat every day"}
                    {formData.frequency === "weekly" && "This schedule will repeat every week"}
                    {formData.frequency === "monthly" && "This schedule will repeat every month"}
                    {formData.frequency === "yearly" && "This schedule will repeat every year"}
                  </p>
                </div>

                {formData.frequency !== "once" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-900">Repeat Until</Label>
                    <Input
                      type="date"
                      value={formData.repeatUntil}
                      onChange={(e) => setFormData({ ...formData, repeatUntil: e.target.value })}
                      className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded h-10"
                    />
                    <p className="text-xs text-gray-500">Stop repeating after this date (optional)</p>
                  </div>
                )}
                </div>
              </div>
            )}

            {/* Step 4: Notification Settings Section */}
            {currentStep === 4 && (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                <Bell size={16} className="sm:w-[18px] sm:h-[18px] text-blue-600" />
                <h3 className="text-sm sm:text-base font-semibold text-blue-700">Notification Settings</h3>
              </div>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded">
                  <Checkbox
                    id="notifyUser"
                    checked={formData.notifyUser}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifyUser: checked === true })}
                    className="mt-0.5 border-blue-400 hover:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 focus-visible:ring-blue-400"
                  />
                  <div className="flex-1">
                    <Label htmlFor="notifyUser" className="cursor-pointer font-medium text-gray-900 text-sm">
                      Notify me (user)
                    </Label>
                    <p className="text-xs text-gray-600 mt-0.5">You will receive email notifications for this schedule</p>
                  </div>
                </div>

                <div className="flex items-start space-x-2 sm:space-x-3 p-2.5 sm:p-3 bg-blue-50 border border-blue-200 rounded">
                  <Checkbox
                    id="notifyClient"
                    checked={formData.notifyClient}
                    onCheckedChange={(checked) => setFormData({ ...formData, notifyClient: checked === true })}
                    className="mt-0.5 border-blue-400 hover:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 focus-visible:ring-blue-400"
                  />
                  <div className="flex-1">
                    <Label htmlFor="notifyClient" className="cursor-pointer font-medium text-gray-900 text-sm">
                      Notify client
                    </Label>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {formData.clientId && formData.clientId !== "none" 
                        ? "Client will receive email notifications (requires client email)"
                        : "Select a client first to enable client notifications"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-900">Advance Notification</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min="0"
                      value={formData.advanceNotificationDays}
                      onChange={(e) => setFormData({ ...formData, advanceNotificationDays: e.target.value })}
                      placeholder="0"
                      className="bg-white border border-gray-300 text-gray-900 focus:border-gray-500 rounded h-10 w-24"
                    />
                    <span className="text-sm text-gray-700">days before due date</span>
                  </div>
                  <p className="text-xs text-gray-500">Send notifications this many days before the schedule is due</p>
                </div>

                {formData.notifyUser && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-900">Custom User Notification Message</Label>
                    <Textarea
                      value={formData.userNotificationMessage}
                      onChange={(e) => setFormData({ ...formData, userNotificationMessage: e.target.value })}
                      placeholder="Leave empty to use default message, or customize your notification..."
                      className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500">Optional: Customize the message you'll receive</p>
                  </div>
                )}

                {formData.notifyClient && formData.clientId && formData.clientId !== "none" && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-900">Custom Client Notification Message</Label>
                    <Textarea
                      value={formData.clientNotificationMessage}
                      onChange={(e) => setFormData({ ...formData, clientNotificationMessage: e.target.value })}
                      placeholder="Leave empty to use default message, or customize the client notification..."
                      className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500">Optional: Customize the message the client will receive</p>
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
          
          <DialogFooter className="border-t border-blue-200 pt-4 gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsModalOpen(false);
                setEditingSchedule(null);
                setCurrentStep(1); // Reset step
                setFormData({
                  title: "",
                  description: "",
                  clientId: "",
                  clientName: "",
                  clientEmail: "",
                  clientPhone: "",
                  clientBusinessType: "",
                  clientType: "other",
                  dueDate: "",
                  frequency: "once",
                  amount: "",
                  notifyUser: true,
                  notifyClient: false,
                  userNotificationMessage: "",
                  clientNotificationMessage: "",
                  advanceNotificationDays: "0",
                  repeatUntil: "",
                });
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-700 text-sm sm:text-base px-3 sm:px-4"
            >
              Cancel
            </Button>
            
            <div className="flex gap-2 flex-col sm:flex-row">
              {currentStep > 1 && (
                <Button 
                  variant="outline" 
                  onClick={prevStep}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-700 text-sm sm:text-base px-3 sm:px-4 order-2 sm:order-1"
                >
                  <ChevronLeft size={14} className="sm:w-4 sm:h-4 mr-1" />
                  Previous
                </Button>
              )}
              
              {currentStep < totalSteps ? (
                <Button 
                  onClick={nextStep} 
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 sm:px-6 text-sm sm:text-base order-1 sm:order-2 flex-1 sm:flex-initial"
                >
                  Next
                  <ChevronRight size={14} className="sm:w-4 sm:h-4 ml-1" />
                </Button>
              ) : (
            <Button 
              onClick={handleSave} 
                  className="bg-blue-600 text-white hover:bg-blue-700 px-4 sm:px-6 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base order-1 sm:order-2 flex-1 sm:flex-initial"
                  disabled={!formData.clientName.trim() || !formData.clientEmail.trim() || !formData.clientBusinessType.trim()}
            >
              {editingSchedule ? "Update Schedule" : "Create Schedule"}
            </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Client Modal (inline from schedules) */}
      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="border-b border-blue-200 pb-4">
            <DialogTitle className="text-xl font-semibold text-blue-700">
              {editingClient ? "Edit Client" : "Create Client"}
            </DialogTitle>
            <p className="text-sm text-gray-600 mt-1">
              {editingClient ? "Update client information" : "Add a client now, then link schedules to them."}
            </p>
          </DialogHeader>

          <div className="py-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Client Name <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={clientForm.name}
                  onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Enter client name"
                  className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Business Type / What They Do <span className="text-red-600">*</span>
                </Label>
                <Input
                  value={clientForm.businessType}
                  onChange={(e) => setClientForm((p) => ({ ...p, businessType: e.target.value }))}
                  placeholder="e.g., Starlink Internet, Worker Payments, Subscription"
                  className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">
                  Email <span className="text-red-600">*</span>
                </Label>
                <Input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="client@example.com"
                  className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-900">Phone</Label>
                <Input
                  type="tel"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+250 7xx xxx xxx"
                  className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">Client Type</Label>
              <Select
                value={clientForm.clientType}
                onValueChange={(value: any) => setClientForm((p) => ({ ...p, clientType: value }))}
              >
                <SelectTrigger className="bg-white border border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debtor">Debtor (owes money)</SelectItem>
                  <SelectItem value="worker">Worker (needs to be paid)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-900">Notes</Label>
              <Textarea
                value={clientForm.notes}
                onChange={(e) => setClientForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes about this client..."
                className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-blue-200 pt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsClientModalOpen(false);
                setEditingClient(null);
                setClientForm({
                  name: "",
                  email: "",
                  phone: "",
                  businessType: "",
                  clientType: "other",
                  notes: "",
                });
              }}
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
              disabled={isCreatingClient}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClient}
              className="bg-blue-600 text-white hover:bg-blue-700 px-6"
              disabled={isCreatingClient}
            >
              {isCreatingClient 
                ? (editingClient ? "Updating..." : "Creating...") 
                : (editingClient ? "Update Client" : "Create Client")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-green-600" />
              Complete Schedule
            </AlertDialogTitle>
            <AlertDialogDescription>
              Mark <strong>{scheduleToComplete?.title}</strong> as completed?
              {scheduleToComplete?.frequency !== "once" && " A new schedule will be created for the next occurrence."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="send-completion-email"
                checked={sendCompletionEmail}
                onCheckedChange={(checked) => setSendCompletionEmail(checked === true)}
              />
              <Label htmlFor="send-completion-email" className="text-sm font-normal cursor-pointer">
                Send completion notification to client/user
              </Label>
            </div>
            
            {sendCompletionEmail && (
              <div className="space-y-2">
                <Label htmlFor="completion-message" className="text-sm font-medium">
                  Completion Message (Optional)
                </Label>
                <Textarea
                  id="completion-message"
                  value={completionMessage}
                  onChange={(e) => setCompletionMessage(e.target.value)}
                  placeholder="Add a message to notify the client/user about this completion..."
                  className="min-h-[100px]"
                  rows={4}
                />
                <p className="text-xs text-gray-500">
                  This message will be sent via email to the client and/or user if notifications are enabled.
                </p>
              </div>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setScheduleToComplete(null);
              setCompletionMessage("");
              setSendCompletionEmail(false);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCompleteConfirm}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              Mark Complete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Schedule Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 size={20} className="text-red-600" />
              Delete Schedule
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{scheduleToDelete?.title}</strong>? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setScheduleToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Client Confirmation Dialog */}
      <AlertDialog open={deleteClientDialogOpen} onOpenChange={setDeleteClientDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 size={20} className="text-red-600" />
              Delete Client
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{clientToDelete?.name}</strong>? 
              This action cannot be undone. If this client has schedules assigned, you must delete those first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClientConfirm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Schedules;
