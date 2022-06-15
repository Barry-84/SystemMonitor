#include <dirent.h>
#include <unistd.h>
#include <string>
#include <vector>
#include <iostream>

#include "linux_parser.h"

using std::stof;
using std::string;
using std::to_string;
using std::vector;

// DONE: An example of how to read data from the filesystem
string LinuxParser::OperatingSystem() {
  string line;
  string key;
  string value;
  std::ifstream filestream(kOSPath);
  if (filestream.is_open()) {
    while (std::getline(filestream, line)) {
      std::replace(line.begin(), line.end(), ' ', '_');
      std::replace(line.begin(), line.end(), '=', ' ');
      std::replace(line.begin(), line.end(), '"', ' ');
      std::istringstream linestream(line);
      while (linestream >> key >> value) {
        if (key == "PRETTY_NAME") {
          std::replace(value.begin(), value.end(), '_', ' ');
          return value;
        }
      }
    }
  }
  return value;
}

// DONE: An example of how to read data from the filesystem
string LinuxParser::Kernel() {
  string os, version, kernel;
  string line;
  std::ifstream stream(kProcDirectory + kVersionFilename);
  if (stream.is_open()) {
    std::getline(stream, line);
    std::istringstream linestream(line);
    linestream >> os >> version >> kernel;
  }
  return kernel;
}

// BONUS: Update this to use std::filesystem
vector<int> LinuxParser::Pids() {
  vector<int> pids;
  DIR* directory = opendir(kProcDirectory.c_str());
  struct dirent* file;
  while ((file = readdir(directory)) != nullptr) {
    // Is this a directory?
    if (file->d_type == DT_DIR) {
      // Is every character of the name a digit?
      string filename(file->d_name);
      if (std::all_of(filename.begin(), filename.end(), isdigit)) {
        int pid = stoi(filename);
        pids.push_back(pid);
      }
    }
  }
  closedir(directory);
  return pids;
}

// TODO: Read and return the system memory utilization
// Linux stores memory utilization for the process in proc/[pid]/status
float LinuxParser::MemoryUtilization() { 
  string line;
  string key;
  string valueMemTotal;
  string valueMemFree;
  std::ifstream stream(kProcDirectory + kMeminfoFilename);
  if (stream.is_open()) {
    std::getline(stream, line);
    std::istringstream linestream(line);
    linestream >> key >> valueMemTotal;

    std::getline(stream, line);
    std::istringstream linestream2(line);
    linestream2 >> key >> valueMemFree;

    // Memory utilization = (MemTotal - MemFree) / MemTotal
    return (std::stof(valueMemTotal) - std::stof(valueMemFree)) / std::stof(valueMemTotal);
  }
  return 0.0;
}

// TODO: Read and return the system uptime
// Linux stores the process up time in /proc/[pid]/status
long LinuxParser::UpTime() {
  string line;
  string seconds_up = "0";
  std::ifstream inputfilestream(kProcDirectory + kUptimeFilename);
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    std::istringstream inputstringstream(line);
    inputstringstream >> seconds_up;
  }
  return stol(seconds_up);
}

// TODO: Read and return the number of jiffies for the system
long LinuxParser::Jiffies() { 
  return ActiveJiffies() + IdleJiffies();
}

// TODO: Read and return the number of active jiffies for a PID
// REMOVE: [[maybe_unused]] once you define the function
long LinuxParser::ActiveJiffies(int pid[[maybe_unused]]) { return 0; }

// TODO: Read and return the number of active jiffies for the system
long LinuxParser::ActiveJiffies() { 
  // kUser_ + kNice_ + kSystem_ + kIRQ_ + kSoftIRQ_ + kSteal_
  // It's inefficient calling CpuUtilization() here and also in IdleJiffies(). 
  // Maybe this is the wrong approach, or there's a better approach at least?
  vector<string> allJiffies = CpuUtilization();
  return std::stol(allJiffies[kUser_]) + std::stol(allJiffies[kNice_]) + std::stol(allJiffies[kIRQ_]) + std::stol(allJiffies[kSoftIRQ_]) + std::stol(allJiffies[kSteal_]);
}

// TODO: Read and return the number of idle jiffies for the system
long LinuxParser::IdleJiffies() { 
  // kIdle_ + kIOwait_
  vector<string> allJiffies = CpuUtilization();
  return std::stol(allJiffies[kIdle_]) + std::stol(allJiffies[kIOwait_]);
}

// TODO: Read and return CPU utilization
vector<string> LinuxParser::CpuUtilization() { 
  string line;
  string key;
  vector<string> string_vector;
  std::ifstream inputfilestream(kProcDirectory + kStatFilename);  
  if (inputfilestream.is_open()) {
    std::getline(inputfilestream, line);
    std::istringstream inputstringstream(line);
    while (inputstringstream >> key) {
      // we don't want the sub-string "cpu"
      if (key != "cpu") {
        string_vector.push_back(key);
      }
    }
  }
  return string_vector; 
}

// TODO: Read and return the total number of processes
int LinuxParser::TotalProcesses() {
  string line;
  string key;
  string number_processes = "0";
  std::ifstream inputfilestream(kProcDirectory + kStatFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      linestream >> key;
      if (key == "processes") {
        linestream >> number_processes;
      }
    }
  }
  return std::stoi(number_processes);
}

// TODO: Read and return the number of running processes
int LinuxParser::RunningProcesses() { 
  string line;
  string key;
  string number_processes = "0";
  std::ifstream inputfilestream(kProcDirectory + kStatFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      linestream >> key;
      if (key == "procs_running") {
        linestream >> number_processes;
      }
    }
  }
  return std::stoi(number_processes);
}

// TODO: Read and return the command associated with a process
// REMOVE: [[maybe_unused]] once you define the function
string LinuxParser::Command(int pid[[maybe_unused]]) { return string(); }

// TODO: Read and return the memory used by a process
// REMOVE: [[maybe_unused]] once you define the function
string LinuxParser::Ram(int pid[[maybe_unused]]) { return string(); }

// TODO: Read and return the user ID associated with a process
// REMOVE: [[maybe_unused]] once you define the function
string LinuxParser::Uid(int pid) { 
  string key, value;
  string line;
  std::ifstream inputfilestream(kProcDirectory + std::to_string(pid) + kStatusFilename);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::istringstream linestream(line);
      while (linestream >> key >> value) {
        if (key == "Uid:") {
          return value;
        }
      }
    }
  }
  return "unknown";
  //return string(); 
}

// TODO: Read and return the user associated with a process
// REMOVE: [[maybe_unused]] once you define the function
string LinuxParser::User(int pid) {
  string line, user, x, uid_;
  string uid = Uid(pid);
  std::ifstream inputfilestream(kPasswordPath);
  if (inputfilestream.is_open()) {
    while (std::getline(inputfilestream, line)) {
      std::replace(line.begin(), line.end(), ':', ' ');
      std::istringstream linestream(line);
      while (linestream >> user >> x >> uid_) {
        if (uid_ == uid) {
            return user;
        }
      }
    }
  }
  return "unknown";
  //return string();
}

// TODO: Read and return the uptime of a process
// REMOVE: [[maybe_unused]] once you define the function
long LinuxParser::UpTime(int pid[[maybe_unused]]) { return 0; }
